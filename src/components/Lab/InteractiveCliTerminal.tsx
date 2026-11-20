import React, { useState, useRef, useEffect } from 'react';
import {
  RotateCcw,
  CheckCircle,
  Activity,
  Cpu,
  Server,
  Laptop
} from 'lucide-react';
import { CourseModule } from '../../types';
import { useAcademy } from '../../context/AcademyContext';
import { applyCiscoPipeFilter, expandInterfaceToken } from './networkCliHelpers';
import { isValidIp, isValidMask, maskToPrefix } from './networkSimEngine';

interface InteractiveCliTerminalProps {
  module: CourseModule;
  courseId: string;
  onCompleted?: () => void;
}

type TerminalMode = 'user' | 'privileged' | 'global' | 'interface' | 'router_ospf';

interface TerminalIfaceState {
  ip: string;
  mask: string;
  adminUp: boolean;
  description?: string;
}

interface RouterSimState {
  hostname: string;
  mode: TerminalMode;
  currentInterface: string;
  ospfProcessId: string;
  routerId: string;
  ospfNetworks: Array<{ network: string; wildcard: string; area: string; raw: string }>;
  passiveInterfaces: string[];
  interfaces: Record<string, TerminalIfaceState>;
  startupConfig: string[] | null;
}

const INITIAL_INTERFACES: Record<string, TerminalIfaceState> = {
  'GigabitEthernet0/0/0': { ip: '10.0.0.1', mask: '255.255.255.252', adminUp: true, description: 'WAN Link to R2-Branch' },
  'GigabitEthernet0/0/1': { ip: '192.168.10.1', mask: '255.255.255.0', adminUp: true, description: 'LAN Gateway SW-Access-01' },
  'Loopback0': { ip: '1.1.1.1', mask: '255.255.255.255', adminUp: true, description: 'OSPF Router ID Loopback' }
};

function createInitialState(): RouterSimState {
  return {
    hostname: 'R1-HQ-Core',
    mode: 'privileged',
    currentInterface: '',
    ospfProcessId: '',
    routerId: '',
    ospfNetworks: [],
    passiveInterfaces: [],
    interfaces: {
      'GigabitEthernet0/0/0': { ...INITIAL_INTERFACES['GigabitEthernet0/0/0'] },
      'GigabitEthernet0/0/1': { ...INITIAL_INTERFACES['GigabitEthernet0/0/1'] },
      'Loopback0': { ...INITIAL_INTERFACES['Loopback0'] }
    },
    startupConfig: null
  };
}

function getPrompt(state: RouterSimState): string {
  switch (state.mode) {
    case 'user':
      return `${state.hostname}>`;
    case 'privileged':
      return `${state.hostname}#`;
    case 'global':
      return `${state.hostname}(config)#`;
    case 'interface':
      return `${state.hostname}(config-if)#`;
    case 'router_ospf':
      return `${state.hostname}(config-router)#`;
  }
}

function resolveTerminalInterface(
  interfaces: Record<string, TerminalIfaceState>,
  rawToken: string
): string | null {
  const norm = rawToken.trim().toLowerCase().replace(/\s+/g, '');
  if (!norm) return null;
  const expanded = expandInterfaceToken(norm);
  const keys = Object.keys(interfaces);
  const matched = keys.find(
    k => k.toLowerCase() === norm || k.toLowerCase() === expanded || k.toLowerCase().replace('gigabitethernet', 'gig') === norm
  );
  if (matched) return matched;
  if (/^loopback\d+$/.test(expanded)) {
    const num = expanded.replace('loopback', '');
    return `Loopback${num}`;
  }
  return null;
}

function buildTerminalRunningConfig(state: RouterSimState): string[] {
  const lines = [
    'Building configuration...',
    '',
    'Current configuration :',
    '!',
    'version 17.6',
    `hostname ${state.hostname}`,
    '!'
  ];
  Object.entries(state.interfaces).forEach(([name, iface]) => {
    lines.push(`interface ${name}`);
    if (iface.description) lines.push(` description ${iface.description}`);
    if (iface.ip && iface.mask) lines.push(` ip address ${iface.ip} ${iface.mask}`);
    if (!iface.adminUp) lines.push(' shutdown');
    lines.push('!');
  });
  if (state.ospfProcessId) {
    lines.push(`router ospf ${state.ospfProcessId}`);
    if (state.routerId) lines.push(` router-id ${state.routerId}`);
    state.passiveInterfaces.forEach(p => lines.push(` passive-interface ${p}`));
    state.ospfNetworks.forEach(n => lines.push(` network ${n.network} ${n.wildcard} area ${n.area}`));
    lines.push('!');
  }
  lines.push('end');
  return lines;
}

function getTerminalHelp(mode: TerminalMode, rawQuery?: string): string[] {
  const showLines = [
    '  show running-config (sh run)      - Display current configuration',
    '  show startup-config (sh start)    - Display saved NVRAM configuration',
    '  show version (sh ver)             - Display IOS XE hardware & uptime',
    '  show ip interface brief           - Display summary of interfaces',
    '  show interfaces [name|description]- Detailed interface status & stats',
    '  show ip route [connected|ospf]    - Display IP routing table',
    '  show ip protocols                 - Display active routing protocols',
    '  show ip ospf [neighbor|interface] - Display OSPF adjacency & interfaces',
    '  show cdp neighbors [detail]       - Display directly connected neighbors',
    '  show history / show clock         - Display command history or system clock'
  ];

  let lines: string[] = [];
  if (mode === 'user') {
    lines = [
      'User EXEC Commands:',
      '  enable (en)                       - Enter Privileged EXEC mode',
      '  show ip interface brief           - Display interface IP summary',
      '  show version / show clock         - Display IOS XE version & clock',
      '  ping <ip> / traceroute <ip>       - Test reachability',
      '  clear / exit                      - Clear screen or exit'
    ];
  } else if (mode === 'global') {
    lines = [
      'Global Configuration Commands (supports "do <show|ping|wr>" anytime):',
      '  hostname <name>                   - Set router hostname',
      '  interface <name> (int g0/0/0)     - Select or create interface / Loopback',
      '  router ospf <process-id>          - Enable OSPF routing process',
      '  no router ospf                    - Remove OSPF routing process',
      '  exit / end (Ctrl+Z)               - Return to Privileged EXEC mode'
    ];
  } else if (mode === 'interface') {
    lines = [
      'Interface Configuration Commands:',
      '  ip address <ip> <mask>            - Configure IPv4 address & subnet mask',
      '  no ip address                     - Remove IPv4 address',
      '  description <text>                - Set interface description',
      '  no shutdown / shutdown            - Administratively enable/disable link',
      '  do <cmd> / exit / end             - Run EXEC command or return'
    ];
  } else if (mode === 'router_ospf') {
    lines = [
      'OSPF Router Configuration Commands:',
      '  router-id <x.x.x.x>               - Configure OSPF router identifier',
      '  network <ip> <wildcard> area <id> - Advertise network in OSPF',
      '  passive-interface <if|default>    - Suppress OSPF Hellos on interface',
      '  do <cmd> / exit / end             - Run EXEC command or return'
    ];
  } else {
    lines = [
      'Privileged EXEC Commands (supports "| include|exclude|begin|section <pat>"):',
      '  configure terminal (conf t)       - Enter global configuration mode',
      '  copy running-config startup-config (wr)',
      ...showLines,
      '  clear ip ospf process             - Reset OSPF neighbor adjacencies',
      '  ping <ip> / traceroute <ip>       - Test IP connectivity',
      '  disable / clear                   - Return to User EXEC or clear screen'
    ];
  }

  const prefix = (rawQuery || '').replace(/\?$/, '').trim().toLowerCase();
  if (prefix) {
    const filtered = lines.filter(l => l.toLowerCase().includes(prefix));
    if (filtered.length > 0) {
      return [`Context help for "${prefix}":`, ...filtered];
    }
  }
  return lines;
}

function getTerminalTabCompletion(
  state: RouterSimState,
  rawInput: string
): { completed: string; suggestions: string[] } {
  const trimmedLeft = rawInput.replace(/^\s+/, '');
  const hasTrailingSpace = /\s$/.test(rawInput);
  const parts = trimmedLeft ? trimmedLeft.split(/\s+/) : [];

  const showCmds = [
    'show running-config',
    'show startup-config',
    'show version',
    'show ip interface brief',
    'show interfaces',
    'show interfaces description',
    'show ip route',
    'show ip protocols',
    'show ip ospf neighbor',
    'show ip ospf interface',
    'show cdp neighbors',
    'show cdp neighbors detail',
    'show history',
    'show clock'
  ];

  // Interface completion after `interface ` or `show interfaces `
  if (
    parts.length >= 1 &&
    !hasTrailingSpace &&
    (('interface'.startsWith(parts[0].toLowerCase()) && parts[0].toLowerCase().startsWith('int')) ||
      trimmedLeft.toLowerCase().startsWith('show interfaces ') ||
      trimmedLeft.toLowerCase().startsWith('sh int '))
  ) {
    const partial = (parts[parts.length - 1] || '').toLowerCase();
    const ifNames = Object.keys(state.interfaces);
    const matches = ifNames.filter(n => n.toLowerCase().startsWith(partial));
    if (matches.length === 1) {
      return { completed: `${parts.slice(0, -1).join(' ')} ${matches[0]} `, suggestions: [] };
    }
    if (matches.length > 1) {
      return { completed: rawInput, suggestions: matches };
    }
  }

  let candidates: string[] = [];
  if (state.mode === 'user') {
    candidates = ['enable', 'show ip interface brief', 'show version', 'show clock', 'ping', 'traceroute', 'clear', 'exit'];
  } else if (state.mode === 'privileged') {
    candidates = [
      'configure terminal',
      'copy running-config startup-config',
      'write memory',
      'clear ip ospf process',
      ...showCmds,
      'ping',
      'traceroute',
      'disable',
      'clear',
      'exit'
    ];
  } else if (state.mode === 'global') {
    candidates = [
      'hostname',
      'interface',
      'router ospf',
      'no router ospf',
      ...showCmds.map(s => `do ${s}`),
      'do write memory',
      'exit',
      'end'
    ];
  } else if (state.mode === 'interface') {
    candidates = [
      'ip address',
      'no ip address',
      'description',
      'no description',
      'no shutdown',
      'shutdown',
      ...showCmds.map(s => `do ${s}`),
      'do write memory',
      'exit',
      'end'
    ];
  } else if (state.mode === 'router_ospf') {
    candidates = [
      'router-id',
      'network',
      'passive-interface',
      'no passive-interface',
      'do show ip ospf neighbor',
      'do show ip route',
      'do write memory',
      'exit',
      'end'
    ];
  }

  const query = trimmedLeft.toLowerCase();
  const matches = candidates.filter(c => c.toLowerCase().startsWith(query));
  if (matches.length === 1) {
    return { completed: `${matches[0]} `, suggestions: [] };
  }
  if (matches.length > 1) {
    let prefix = matches[0];
    for (let i = 1; i < matches.length; i++) {
      let j = 0;
      while (j < prefix.length && j < matches[i].length && prefix[j].toLowerCase() === matches[i][j].toLowerCase()) {
        j++;
      }
      prefix = prefix.slice(0, j);
    }
    return {
      completed: prefix.length > trimmedLeft.length ? prefix : rawInput,
      suggestions: matches
    };
  }
  return { completed: rawInput, suggestions: [] };
}

export const InteractiveCliTerminal: React.FC<InteractiveCliTerminalProps> = ({
  module,
  courseId,
  onCompleted
}) => {
  const { completeModule, recordStudyTime } = useAcademy();
  const labData = module.lab;

  const [history, setHistory] = useState<string[]>([
    'Netplus Virtual IOS XE Software (X86_64_LINUX_IOSD-UNIVERSALK9-M), Version 17.06.01a',
    'Technical Support: https://netplus.academy/support',
    'Compiled Thu 15-Oct-26 14:18 by marcus_vance',
    '',
    '*Oct 21 21:14:02.119: %LINK-3-UPDOWN: Interface GigabitEthernet0/0/0, changed state to up',
    '*Oct 21 21:14:03.120: %LINEPROTO-5-UPDOWN: Line protocol on Interface GigabitEthernet0/0/0, changed state to up',
    '',
    'Type "help" or "?" for Cisco IOS commands. Press Tab to autocomplete, Ctrl+Z to end.',
    '-------------------------------------------------------------------------'
  ]);
  const [inputVal, setInputVal] = useState('');
  const [commandLog, setCommandLog] = useState<string[]>([]);
  const [cmdCursor, setCmdCursor] = useState(-1);
  const [completedObjectives, setCompletedObjectives] = useState<string[]>([]);
  const [isFinished, setIsFinished] = useState(false);

  const [routerConfig, setRouterConfig] = useState<RouterSimState>(createInitialState);
  const currentPrompt = getPrompt(routerConfig);

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [history]);

  const checkObjective = (keyword: string) => {
    setCompletedObjectives(prev => {
      if (prev.includes(keyword)) return prev;
      const updated = [...prev, keyword];
      if (updated.length >= 3 && !isFinished) {
        setIsFinished(true);
        completeModule(courseId, module.id);
        if (onCompleted) onCompleted();
      }
      return updated;
    });
  };

  const runCommand = (rawCmd: string) => {
    const cmd = rawCmd.trim();
    if (!cmd) return;

    const lowerCmd = cmd.toLowerCase();
    recordStudyTime(15, 'course');
    const promptBefore = getPrompt(routerConfig);
    const newHistory = [...history, `${promptBefore} ${cmd}`];
    setCommandLog(prev => [...prev, cmd]);
    setCmdCursor(-1);

    if (lowerCmd === 'clear' || lowerCmd === 'cls') {
      setHistory([]);
      return;
    }

    const nextState: RouterSimState = {
      ...routerConfig,
      ospfNetworks: [...routerConfig.ospfNetworks],
      passiveInterfaces: [...routerConfig.passiveInterfaces],
      interfaces: Object.fromEntries(
        Object.entries(routerConfig.interfaces).map(([k, v]) => [k, { ...v }])
      )
    };

    const isConfigSubMode = nextState.mode !== 'user' && nextState.mode !== 'privileged';
    const effectiveCmd =
      isConfigSubMode && lowerCmd.startsWith('do ') ? cmd.slice(3).trim() : cmd;
    const effectiveLower = effectiveCmd.toLowerCase();
    const execAllowed = !(isConfigSubMode && !lowerCmd.startsWith('do '));

    // Pipe filter extraction for show commands
    const pipeIdx = effectiveLower.indexOf('|');
    const baseShowLower = (pipeIdx >= 0 ? effectiveLower.slice(0, pipeIdx) : effectiveLower).trim();
    const pipeExpr = pipeIdx >= 0 ? effectiveCmd.slice(pipeIdx + 1).trim() : '';

    const pushShow = (lines: string[]) => {
      newHistory.push(...(pipeExpr ? applyCiscoPipeFilter(lines, pipeExpr) : lines));
    };

    // Context help
    if (lowerCmd === 'help' || lowerCmd === '?' || lowerCmd.endsWith(' ?')) {
      newHistory.push(...getTerminalHelp(nextState.mode, cmd));
    } else if (lowerCmd === 'enable' || lowerCmd === 'en' || lowerCmd === 'ena') {
      nextState.mode = 'privileged';
    } else if (lowerCmd === 'disable') {
      nextState.mode = 'user';
      nextState.currentInterface = '';
    } else if (/^conf(ig|igure)?\s+t(er|erm|ermi|ermin|ermina|erminal)?$/.test(lowerCmd)) {
      if (nextState.mode === 'user') {
        newHistory.push('% Type "enable" first to enter Privileged EXEC mode.');
      } else {
        nextState.mode = 'global';
        nextState.currentInterface = '';
        newHistory.push('Enter configuration commands, one per line. End with CNTL/Z.');
      }
    } else if (lowerCmd === 'end') {
      if (nextState.mode !== 'user') {
        nextState.mode = 'privileged';
        nextState.currentInterface = '';
        newHistory.push('%SYS-5-CONFIG_I: Configured from console by console');
      }
    } else if (lowerCmd === 'exit' || lowerCmd === 'ex') {
      if (nextState.mode === 'interface' || nextState.mode === 'router_ospf') {
        nextState.mode = 'global';
        nextState.currentInterface = '';
      } else if (nextState.mode === 'global') {
        nextState.mode = 'privileged';
        newHistory.push('%SYS-5-CONFIG_I: Configured from console by console');
      } else if (nextState.mode === 'privileged') {
        nextState.mode = 'user';
      }
    } else if (
      (effectiveLower === 'write' ||
        effectiveLower === 'wr' ||
        effectiveLower === 'write memory' ||
        effectiveLower === 'write mem' ||
        effectiveLower === 'wr mem' ||
        /^copy\s+r(un|unning-config)?\s+s(tart|tartup-config)?$/.test(effectiveLower)) &&
      execAllowed &&
      nextState.mode !== 'user'
    ) {
      nextState.startupConfig = buildTerminalRunningConfig(nextState);
      newHistory.push('Building configuration...', '[OK]');
    } else if (
      (effectiveLower === 'clear ip ospf process' || effectiveLower === 'clear ip ospf proc') &&
      execAllowed &&
      nextState.mode !== 'user'
    ) {
      if (!nextState.ospfProcessId) {
        newHistory.push('% OSPF process is not configured.');
      } else {
        newHistory.push(
          `*Oct 21 21:18:10.004: %OSPF-5-ADJCHG: Process ${nextState.ospfProcessId}, Nbr 2.2.2.2 on GigabitEthernet0/0/0 from LOADING to FULL, Loading Done`
        );
      }
    } else if (
      (baseShowLower.startsWith('show ') || baseShowLower.startsWith('sh ')) &&
      (execAllowed || nextState.mode === 'user')
    ) {
      const subTokens = baseShowLower.split(/\s+/).slice(1);
      const sub = subTokens.join(' ');
      const firstSub = subTokens[0] || '';

      if (firstSub.length >= 3 && 'running-config'.startsWith(firstSub) && subTokens.length === 1) {
        pushShow(buildTerminalRunningConfig(nextState));
      } else if (firstSub.length >= 2 && 'startup-config'.startsWith(firstSub) && subTokens.length === 1) {
        pushShow(
          nextState.startupConfig || [
            '%% startup-config is not present (run "copy running-config startup-config" or "wr").'
          ]
        );
      } else if (firstSub.length >= 2 && 'version'.startsWith(firstSub) && subTokens.length === 1) {
        pushShow([
          'Cisco IOS XE Software, Version 17.06.01a (ISR4331/K9)',
          `System image file is "bootflash:isr4300-universalk9.17.06.01a.SPA.bin"`,
          `${nextState.hostname} uptime is 2 hours, 15 minutes`,
          '32768K bytes of non-volatile configuration memory.',
          'Configuration register is 0x2102'
        ]);
      } else if (firstSub.length >= 2 && 'clock'.startsWith(firstSub) && subTokens.length === 1) {
        pushShow([new Date().toUTCString()]);
      } else if (firstSub.length >= 3 && 'history'.startsWith(firstSub) && subTokens.length === 1) {
        const recent = [...commandLog, cmd].slice(-20);
        pushShow(recent.map((c, idx) => `  ${String(idx + 1).padStart(2, ' ')}  ${c}`));
      } else if (
        subTokens[0] === 'ip' &&
        subTokens[1] &&
        'interface'.startsWith(subTokens[1]) &&
        subTokens[2] &&
        'brief'.startsWith(subTokens[2])
      ) {
        const out = [
          'Interface                  IP-Address      OK? Method Status                Protocol'
        ];
        Object.entries(nextState.interfaces).forEach(([name, iface]) => {
          const status = iface.adminUp ? 'up' : 'administratively down';
          const proto = iface.adminUp ? 'up' : 'down';
          out.push(
            `${name.padEnd(27, ' ')}${(iface.ip || 'unassigned').padEnd(16, ' ')}YES manual ${status.padEnd(22, ' ')}${proto}`
          );
        });
        pushShow(out);
      } else if (
        subTokens[0] &&
        'interfaces'.startsWith(subTokens[0]) &&
        subTokens[0].length >= 3 &&
        subTokens[1] &&
        'description'.startsWith(subTokens[1])
      ) {
        const out = ['Interface                      Status         Protocol Description'];
        Object.entries(nextState.interfaces).forEach(([name, iface]) => {
          const st = iface.adminUp ? 'up' : 'admin down';
          const pr = iface.adminUp ? 'up' : 'down';
          out.push(`${name.padEnd(31, ' ')}${st.padEnd(15, ' ')}${pr.padEnd(9, ' ')}${iface.description || ''}`);
        });
        pushShow(out);
      } else if (subTokens[0] && 'interfaces'.startsWith(subTokens[0]) && subTokens[0].length >= 3) {
        const filterArg = subTokens.slice(1).join('');
        const targetKey = filterArg ? resolveTerminalInterface(nextState.interfaces, filterArg) : null;
        const entries = targetKey
          ? [[targetKey, nextState.interfaces[targetKey]] as const].filter(([, v]) => Boolean(v))
          : Object.entries(nextState.interfaces);
        if (filterArg && entries.length === 0) {
          pushShow([`% Invalid interface "${filterArg}".`]);
        } else {
          const out: string[] = [];
          entries.forEach(([name, iface]) => {
            out.push(`${name} is ${iface.adminUp ? 'up' : 'administratively down'}, line protocol is ${iface.adminUp ? 'up' : 'down'}`);
            if (iface.description) out.push(`  Description: ${iface.description}`);
            if (iface.ip) out.push(`  Internet address is ${iface.ip}/${maskToPrefix(iface.mask)}`);
            out.push('  MTU 1500 bytes, BW 1000000 Kbit/sec, Full-duplex, 1000Mb/s');
          });
          pushShow(out);
        }
      } else if (subTokens[0] === 'ip' && subTokens[1] && 'route'.startsWith(subTokens[1]) && subTokens[1].length >= 2) {
        const mod = subTokens[2] || '';
        const ospfReady = nextState.ospfNetworks.length > 0;
        const out = [
          'Codes: C - connected, S - static, R - RIP, M - mobile, B - BGP',
          '       O - OSPF, IA - OSPF inter area, N1 - OSPF NSSA external type 1',
          '',
          'Gateway of last resort is not set',
          ''
        ];
        if (!mod || 'connected'.startsWith(mod)) {
          Object.entries(nextState.interfaces).forEach(([name, iface]) => {
            if (iface.adminUp && iface.ip) {
              out.push(`C        ${iface.ip}/${maskToPrefix(iface.mask)} is directly connected, ${name}`);
            }
          });
        }
        if ((!mod || 'ospf'.startsWith(mod)) && (ospfReady || !mod)) {
          out.push(
            'O        192.168.20.0/24 [110/2] via 10.0.0.2, 00:01:14, GigabitEthernet0/0/0',
            'O        2.2.2.2/32 [110/2] via 10.0.0.2, 00:01:14, GigabitEthernet0/0/0'
          );
        }
        pushShow(out);
        checkObjective('show ip route');
      } else if (subTokens[0] === 'ip' && subTokens[1] && 'protocols'.startsWith(subTokens[1]) && subTokens[1].length >= 4) {
        if (!nextState.ospfProcessId) {
          pushShow(['No dynamic routing protocols configured yet.']);
        } else {
          const out = [
            `Routing Protocol is "ospf ${nextState.ospfProcessId}"`,
            `  Router ID ${nextState.routerId || '1.1.1.1'}`,
            '  Routing for Networks:'
          ];
          nextState.ospfNetworks.forEach(n => out.push(`    ${n.network} ${n.wildcard} area ${n.area}`));
          if (nextState.passiveInterfaces.length > 0) {
            out.push('  Passive Interface(s):', ...nextState.passiveInterfaces.map(p => `    ${p}`));
          }
          pushShow(out);
        }
      } else if (subTokens[0] === 'ip' && subTokens[1] === 'ospf') {
        const ospfSub = subTokens[2] || 'neighbor';
        if ('interface'.startsWith(ospfSub)) {
          const pid = nextState.ospfProcessId || '1';
          const out = ['Interface    PID   Area            IP Address/Mask    Cost  State Nbrs'];
          Object.entries(nextState.interfaces).forEach(([name, iface]) => {
            if (iface.ip) {
              out.push(
                `${name.replace('GigabitEthernet', 'Gi').padEnd(13, ' ')}${pid.padEnd(6, ' ')}0               ${iface.ip}/${maskToPrefix(iface.mask)}    ${iface.adminUp ? '1     UP   ' : '1     DOWN '}`
              );
            }
          });
          pushShow(out);
        } else {
          pushShow([
            'Neighbor ID     Pri   State           Dead Time   Address         Interface',
            `${nextState.routerId === '2.2.2.2' ? '2.2.2.3' : '2.2.2.2'}           1   FULL/  -        00:00:36    10.0.0.2        GigabitEthernet0/0/0`
          ]);
          checkObjective('show ip ospf neighbor');
        }
      } else if (sub === 'cdp neighbors' || sub === 'cdp nei' || sub === 'cdp neighbors detail' || sub === 'cdp nei det') {
        if (sub.endsWith('detail') || sub.endsWith('det')) {
          pushShow([
            '-------------------------',
            'Device ID: R2-Branch',
            'Entry address(es): IP address: 10.0.0.2',
            'Platform: Cisco ISR4331/K9,  Capabilities: Router',
            'Interface: GigabitEthernet0/0/0,  Port ID (outgoing port): GigabitEthernet0/0/0',
            '-------------------------',
            'Device ID: SW-Access-01',
            'Platform: Cisco WS-C2960-24TT-L,  Capabilities: Switch IGMP',
            'Interface: GigabitEthernet0/0/1,  Port ID (outgoing port): GigabitEthernet0/1'
          ]);
        } else {
          pushShow([
            'Capability Codes: R - Router, S - Switch, I - IGMP',
            'Device ID        Local Intrfce     Holdtme    Capability  Platform  Port ID',
            'R2-Branch        Gi0/0/0           148        R           ISR4331   Gi0/0/0',
            'SW-Access-01     Gi0/0/1           152        S I         WS-C2960  Gi0/1'
          ]);
        }
      } else {
        newHistory.push(`${' '.repeat(promptBefore.length + 1)}^`);
        newHistory.push(`% Invalid input detected at '^' marker.`);
      }
    } else if (lowerCmd.startsWith('hostname ')) {
      if (!isConfigSubMode) {
        newHistory.push('% Enter Global Configuration mode ("conf t") first.');
      } else {
        const nextHost = cmd.split(/\s+/)[1];
        if (nextHost) nextState.hostname = nextHost;
      }
    } else if (lowerCmd.startsWith('router ospf')) {
      if (!isConfigSubMode) {
        newHistory.push('% Enter Global Configuration mode ("conf t") first.');
      } else {
        const procId = cmd.split(/\s+/)[2] || '1';
        nextState.mode = 'router_ospf';
        nextState.ospfProcessId = procId;
        checkObjective('router ospf ' + procId);
      }
    } else if (lowerCmd === 'no router ospf') {
      if (isConfigSubMode) {
        nextState.ospfProcessId = '';
        nextState.routerId = '';
        nextState.ospfNetworks = [];
        nextState.passiveInterfaces = [];
        if (nextState.mode === 'router_ospf') nextState.mode = 'global';
      }
    } else if (lowerCmd.startsWith('router-id')) {
      if (nextState.mode !== 'router_ospf') {
        newHistory.push('% Enter "router ospf <id>" configuration mode first.');
      } else {
        const id = cmd.split(/\s+/)[1] || '1.1.1.1';
        if (!isValidIp(id)) {
          newHistory.push('% Invalid Router-ID IPv4 address.');
        } else {
          nextState.routerId = id;
          checkObjective('router-id ' + id);
          newHistory.push('% OSPF: Reload or "clear ip ospf process" may be required for new Router ID to take effect');
        }
      }
    } else if (lowerCmd.startsWith('network')) {
      if (nextState.mode !== 'router_ospf') {
        newHistory.push('% Enter "router ospf <id>" configuration mode first.');
      } else {
        const parts = cmd.split(/\s+/);
        const network = parts[1] || '10.0.0.0';
        const wildcard = parts[2] || '0.0.0.3';
        const area = parts[4] || '0';
        nextState.ospfNetworks.push({ network, wildcard, area, raw: cmd });
        checkObjective('network');
        newHistory.push('*Oct 21 21:16:44.201: %OSPF-5-ADJCHG: Process 1, Nbr 10.0.0.2 on GigabitEthernet0/0/0 from LOADING to FULL, Loading Done');
      }
    } else if (lowerCmd.startsWith('passive-interface ')) {
      if (nextState.mode !== 'router_ospf') {
        newHistory.push('% Enter "router ospf <id>" configuration mode first.');
      } else {
        const arg = cmd.split(/\s+/).slice(1).join('');
        const resolved = arg.toLowerCase() === 'default' ? 'default' : resolveTerminalInterface(nextState.interfaces, arg);
        if (!resolved) {
          newHistory.push(`% Invalid interface "${arg}".`);
        } else if (!nextState.passiveInterfaces.includes(resolved)) {
          nextState.passiveInterfaces.push(resolved);
        }
      }
    } else if (lowerCmd.startsWith('no passive-interface ')) {
      if (nextState.mode === 'router_ospf') {
        const arg = cmd.split(/\s+/).slice(2).join('');
        const resolved = arg.toLowerCase() === 'default' ? 'default' : resolveTerminalInterface(nextState.interfaces, arg);
        if (resolved) {
          nextState.passiveInterfaces = nextState.passiveInterfaces.filter(p => p !== resolved);
        }
      }
    } else if (/^(interface|inter|int)\s+/i.test(lowerCmd)) {
      if (!isConfigSubMode) {
        newHistory.push('% Enter Global Configuration mode ("conf t") first.');
      } else {
        const target = cmd.split(/\s+/).slice(1).join('');
        const resolved = resolveTerminalInterface(nextState.interfaces, target);
        if (!resolved) {
          newHistory.push(`% Invalid interface "${target}". Run "show ip interface brief" to view interfaces.`);
        } else {
          if (!nextState.interfaces[resolved]) {
            nextState.interfaces[resolved] = { ip: '', mask: '', adminUp: true };
          }
          nextState.mode = 'interface';
          nextState.currentInterface = resolved;
        }
      }
    } else if (/^ip\s+(address|addre|addr|add)\s+/i.test(lowerCmd)) {
      if (nextState.mode !== 'interface' || !nextState.currentInterface) {
        newHistory.push('% Must be inside interface configuration mode.');
      } else {
        const parts = cmd.split(/\s+/);
        const ip = parts[2];
        const mask = parts[3];
        if (!ip || !mask || !isValidIp(ip) || !isValidMask(mask)) {
          newHistory.push('% Usage: ip address <ipv4-address> <subnet-mask>');
        } else {
          nextState.interfaces[nextState.currentInterface].ip = ip;
          nextState.interfaces[nextState.currentInterface].mask = mask;
        }
      }
    } else if (/^no\s+ip\s+(address|addre|addr|add)$/i.test(lowerCmd)) {
      if (nextState.mode === 'interface' && nextState.currentInterface) {
        nextState.interfaces[nextState.currentInterface].ip = '';
        nextState.interfaces[nextState.currentInterface].mask = '';
      }
    } else if (lowerCmd.startsWith('description ') || lowerCmd.startsWith('desc ')) {
      if (nextState.mode !== 'interface' || !nextState.currentInterface) {
        newHistory.push('% Enter interface configuration mode first.');
      } else {
        nextState.interfaces[nextState.currentInterface].description = cmd.split(/\s+/).slice(1).join(' ');
      }
    } else if (lowerCmd === 'no description' || lowerCmd === 'no desc') {
      if (nextState.mode === 'interface' && nextState.currentInterface) {
        nextState.interfaces[nextState.currentInterface].description = undefined;
      }
    } else if (/^no\s+sh(u|ut|utd|utdo|utdow|utdown)?$/i.test(lowerCmd)) {
      if (nextState.mode !== 'interface' || !nextState.currentInterface) {
        newHistory.push('% Enter interface configuration mode first.');
      } else {
        nextState.interfaces[nextState.currentInterface].adminUp = true;
        newHistory.push(`%LINK-3-UPDOWN: Interface ${nextState.currentInterface}, changed state to up`);
      }
    } else if (/^sh(u|ut|utd|utdo|utdow|utdown)$/i.test(lowerCmd)) {
      if (nextState.mode !== 'interface' || !nextState.currentInterface) {
        newHistory.push('% Enter interface configuration mode first.');
      } else {
        nextState.interfaces[nextState.currentInterface].adminUp = false;
        newHistory.push(`%LINK-5-CHANGED: Interface ${nextState.currentInterface}, changed state to administratively down`);
      }
    } else if ((effectiveLower.startsWith('ping ') || effectiveLower.startsWith('traceroute ') || effectiveLower.startsWith('tracert ')) && (execAllowed || nextState.mode === 'user')) {
      const target = effectiveCmd.split(/\s+/)[1] || '10.0.0.2';
      if (effectiveLower.startsWith('ping ')) {
        newHistory.push(
          'Type escape sequence to abort.',
          `Sending 5, 100-byte ICMP Echos to ${target}, timeout is 2 seconds:`,
          '!!!!!',
          'Success rate is 100 percent (5/5), round-trip min/avg/max = 1/2/4 ms'
        );
      } else {
        newHistory.push(
          `Tracing the route to ${target}:`,
          `  1 10.0.0.2 (R2-Branch) 2 msec 2 msec 1 msec`
        );
      }
    } else {
      newHistory.push(`${' '.repeat(promptBefore.length + 1)}^`);
      newHistory.push(`% Invalid input detected at '^' marker. Type "?" or press Tab for help.`);
    }

    setHistory(newHistory);
    setRouterConfig(nextState);
  };

  const handleCommandSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cmd = inputVal.trim();
    if (!cmd) return;
    setInputVal('');
    runCommand(cmd);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.ctrlKey && !e.metaKey && !e.altKey) {
      const key = e.key.toLowerCase();
      if (key === 'z') {
        e.preventDefault();
        if (routerConfig.mode !== 'user' && routerConfig.mode !== 'privileged') {
          setInputVal('');
          runCommand('end');
        }
        return;
      }
      if (key === 'c') {
        const inputEl = e.currentTarget;
        const hasInputSelection =
          inputEl.selectionStart !== null &&
          inputEl.selectionEnd !== null &&
          inputEl.selectionStart !== inputEl.selectionEnd;
        const hasWindowSelection = Boolean(window.getSelection()?.toString());
        if (!hasInputSelection && !hasWindowSelection) {
          e.preventDefault();
          setHistory(prev => [...prev, `${currentPrompt} ${inputVal}^C`]);
          setInputVal('');
          setCmdCursor(-1);
        }
        return;
      }
      if (key === 'l') {
        e.preventDefault();
        setHistory([]);
        return;
      }
    }

    if (e.key === 'Tab') {
      e.preventDefault();
      const { completed, suggestions } = getTerminalTabCompletion(routerConfig, inputVal);
      if (completed !== inputVal) {
        setInputVal(completed);
      } else if (suggestions.length > 0) {
        setHistory(prev => [
          ...prev,
          `${currentPrompt} ${inputVal}`,
          suggestions.slice(0, 10).join('    ')
        ]);
      }
      return;
    }

    if (commandLog.length === 0) return;

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      const nextIdx = cmdCursor < 0 ? commandLog.length - 1 : Math.max(0, cmdCursor - 1);
      setCmdCursor(nextIdx);
      setInputVal(commandLog[nextIdx]);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (cmdCursor < 0) return;
      if (cmdCursor >= commandLog.length - 1) {
        setCmdCursor(-1);
        setInputVal('');
      } else {
        const nextIdx = cmdCursor + 1;
        setCmdCursor(nextIdx);
        setInputVal(commandLog[nextIdx]);
      }
    }
  };

  const resetTerminal = () => {
    setHistory([
      'Netplus Virtual IOS XE Software initialized.',
      'R1-HQ-Core configuration reset to default state.',
      'Type "help" or "?" for available commands.'
    ]);
    setRouterConfig(createInitialState());
    setCommandLog([]);
    setCmdCursor(-1);
    setInputVal('');
    setCompletedObjectives([]);
    setIsFinished(false);
  };

  return (
    <div className="space-y-4">
      {/* Objective banner */}
      <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 text-white flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 rounded bg-blue-600/80 text-[10px] font-mono uppercase font-bold text-blue-100">
              Interactive Lab
            </span>
            <h3 className="text-sm font-bold text-white">
              {labData?.objective || 'Configure OSPF Adjacency and Routing'}
            </h3>
          </div>
          <p className="text-xs text-slate-300">
            Use the embedded Cisco IOS terminal below. Enter the required routing commands to establish adjacency with R2.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={resetTerminal}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700"
            title="Reset Terminal Session"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Split layout: Topology Viewer on Top/Side & Terminal */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Topology Map */}
        <div className="lg:col-span-1 p-4 rounded-xl bg-slate-950 border border-slate-800 text-white flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3 border-b border-slate-800 pb-2">
              <span className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                Live Topology Fabric
              </span>
              <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/70 px-1.5 py-0.5 rounded border border-emerald-800">
                Fabric Online
              </span>
            </div>

            {/* Simulated Canvas / Topology Nodes */}
            <div className="relative h-64 w-full bg-slate-900/60 rounded-lg border border-slate-800/80 p-3 overflow-hidden flex flex-col justify-around">
              {/* Core Router R1 */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 p-2 rounded-lg bg-blue-950/60 border border-blue-500/40 text-blue-200">
                  <Cpu className="w-5 h-5 text-blue-400" />
                  <div>
                    <p className="text-xs font-bold leading-none">{routerConfig.hostname}</p>
                    <p className="text-[10px] font-mono text-slate-400">
                      {routerConfig.interfaces['GigabitEthernet0/0/0']?.ip || '10.0.0.1'}/30 (Gig0/0/0)
                    </p>
                  </div>
                </div>

                <div className="flex-1 mx-2 flex flex-col items-center">
                  <span className="text-[9px] font-mono text-slate-400">Gig0/0/0 WAN Link</span>
                  <div className="w-full h-0.5 bg-gradient-to-r from-blue-500 via-emerald-400 to-indigo-500 relative">
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]" />
                  </div>
                  <span className="text-[9px] font-mono text-emerald-400">OSPF Area 0</span>
                </div>

                {/* Branch Router R2 */}
                <div className="flex items-center gap-2 p-2 rounded-lg bg-indigo-950/60 border border-indigo-500/40 text-indigo-200">
                  <Cpu className="w-5 h-5 text-indigo-400" />
                  <div>
                    <p className="text-xs font-bold leading-none">R2-Branch</p>
                    <p className="text-[10px] font-mono text-slate-400">10.0.0.2/30 (Gig0/0/0)</p>
                  </div>
                </div>
              </div>

              {/* Lower access switch and PC */}
              <div className="pt-2 border-t border-slate-800/60 flex items-center justify-around">
                <div className="flex items-center gap-1.5 p-1.5 rounded bg-slate-800/80 text-slate-300">
                  <Server className="w-4 h-4 text-cyan-400" />
                  <span className="text-[11px] font-mono">SW-Access-01</span>
                </div>
                <div className="h-0.5 w-12 bg-slate-700" />
                <div className="flex items-center gap-1.5 p-1.5 rounded bg-slate-800/80 text-slate-300">
                  <Laptop className="w-4 h-4 text-amber-400" />
                  <span className="text-[11px] font-mono">PC-A (192.168.10.50)</span>
                </div>
              </div>
            </div>
          </div>

          {/* Objectives checklist */}
          <div className="mt-4 pt-3 border-t border-slate-800">
            <p className="text-[11px] font-mono font-bold text-slate-400 uppercase tracking-wider mb-2">
              Verification Benchmarks:
            </p>
            <div className="space-y-1.5 text-xs">
              <div className="flex items-center gap-2">
                <CheckCircle className={`w-3.5 h-3.5 ${completedObjectives.some(o => o.includes('router ospf')) ? 'text-emerald-400' : 'text-slate-600'}`} />
                <span className={completedObjectives.some(o => o.includes('router ospf')) ? 'text-slate-200 line-through' : 'text-slate-400'}>
                  1. Initialize OSPF process: <code>router ospf 1</code>
                </span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className={`w-3.5 h-3.5 ${completedObjectives.some(o => o.includes('router-id')) ? 'text-emerald-400' : 'text-slate-600'}`} />
                <span className={completedObjectives.some(o => o.includes('router-id')) ? 'text-slate-200 line-through' : 'text-slate-400'}>
                  2. Assign router identifier: <code>router-id 1.1.1.1</code>
                </span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className={`w-3.5 h-3.5 ${completedObjectives.some(o => o.includes('network')) ? 'text-emerald-400' : 'text-slate-600'}`} />
                <span className={completedObjectives.some(o => o.includes('network')) ? 'text-slate-200 line-through' : 'text-slate-400'}>
                  3. Advertise link into Area 0: <code>network 10.0.0.0 0.0.0.3 area 0</code>
                </span>
              </div>
            </div>

            {isFinished && (
              <div className="mt-3 p-2.5 rounded-lg bg-emerald-950/80 border border-emerald-600/50 text-emerald-300 text-xs flex items-center gap-2 animate-bounce">
                <CheckCircle className="w-4 h-4 text-emerald-400" />
                <span className="font-semibold">Lab Accomplished! Module Marked Complete.</span>
              </div>
            )}
          </div>
        </div>

        {/* Cisco Terminal */}
        <div className="lg:col-span-2 rounded-xl bg-slate-950 border border-slate-800 text-cyan-400 font-mono shadow-xl flex flex-col h-[480px]">
          {/* Terminal Window Header */}
          <div className="px-4 py-2 bg-slate-900 border-b border-slate-800 flex items-center justify-between select-none">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full bg-red-500/80" />
                <div className="w-3 h-3 rounded-full bg-amber-500/80" />
                <div className="w-3 h-3 rounded-full bg-emerald-500/80" />
              </div>
              <span className="text-xs text-slate-300 font-mono pl-2 font-medium">
                {routerConfig.hostname} (Serial: ttyS0 / 9600-8-N-1)
              </span>
            </div>
            <span className="text-[10px] text-slate-400">Tab: Complete · Up/Down: History · Ctrl+Z: End</span>
          </div>

          {/* Terminal Output Area */}
          <div
            onClick={() => inputRef.current?.focus()}
            className="flex-1 p-4 overflow-y-auto text-xs leading-relaxed space-y-1 cursor-text"
          >
            {history.map((line, idx) => (
              <div key={idx} className="whitespace-pre-wrap break-words">
                {/^[A-Za-z0-9_.-]+(\([^)]+\))?[>#]\s/.test(line) ? (
                  <span className="text-yellow-400 font-bold">{line}</span>
                ) : line.startsWith('%') || /^\s*\^$/.test(line) ? (
                  <span className="text-amber-300">{line}</span>
                ) : line.startsWith('*') ? (
                  <span className="text-cyan-300/80">{line}</span>
                ) : (
                  <span className="text-slate-300">{line}</span>
                )}
              </div>
            ))}

            {/* Active input line */}
            <form onSubmit={handleCommandSubmit} className="flex items-center gap-1 text-xs pt-1">
              <span className="text-yellow-400 font-bold whitespace-nowrap">{currentPrompt}</span>
              <input
                ref={inputRef}
                type="text"
                value={inputVal}
                onChange={(e) => setInputVal(e.target.value)}
                onKeyDown={handleKeyDown}
                autoFocus
                placeholder="Type Cisco IOS command, ? for help, Tab to complete..."
                className="flex-1 bg-transparent border-none outline-none text-cyan-300 font-mono text-xs focus:ring-0 p-0 placeholder-slate-600"
              />
            </form>
            <div ref={bottomRef} />
          </div>

          {/* Terminal Quick Command Hints */}
          <div className="p-2.5 bg-slate-900/90 border-t border-slate-800 flex items-center gap-1.5 overflow-x-auto text-[11px]">
            <span className="text-slate-400 font-semibold px-1 shrink-0">Quick Run:</span>
            {[
              'conf t',
              'router ospf 1',
              'router-id 1.1.1.1',
              'network 10.0.0.0 0.0.0.3 area 0',
              'show ip route',
              'show ip ospf nei',
              'show cdp nei',
              'show run'
            ].map((shortcut, i) => (
              <button
                key={i}
                type="button"
                onClick={() => {
                  setInputVal(shortcut);
                  inputRef.current?.focus();
                }}
                className="whitespace-nowrap px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 hover:border-slate-500 transition-colors shrink-0"
              >
                {shortcut}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
