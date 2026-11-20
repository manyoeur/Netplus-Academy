import {
  SimDevice,
  SimDeviceInterface,
  SimLink
} from './networkSimTypes';

export interface CiscoShowDeps {
  isIfUp: (device: SimDevice, iface: SimDeviceInterface) => boolean;
  computeRoutes: (device: SimDevice) => Array<{
    code: 'C' | 'S' | 'O';
    network: string;
    mask: string;
    prefix: number;
    adminDistance: number;
    metric: number;
    nextHop?: string;
    exitInterface: string;
  }>;
  wildcardToMask: (w: string) => string;
  matchesPrefix: (ip: string, net: string, mask: string) => boolean;
}

export function buildRunningConfigLines(device: SimDevice): string[] {
  const lines: string[] = [
    'Building configuration...',
    '',
    'Current configuration :',
    '!',
    'version 15.9',
    device.servicePasswordEncryption
      ? 'service password-encryption'
      : 'no service password-encryption',
    '!',
    `hostname ${device.name}`,
    '!'
  ];

  if (device.enableSecret) {
    lines.push(
      device.servicePasswordEncryption
        ? 'enable secret 5 $1$netplus$encrypted'
        : `enable secret ${device.enableSecret}`
    );
  }
  if (device.ipDomainLookup === false) {
    lines.push('no ip domain-lookup');
  }
  if (device.domainName) {
    lines.push(`ip domain-name ${device.domainName}`);
  }
  if (device.nameServer) {
    lines.push(`ip name-server ${device.nameServer}`);
  }
  if (device.sshVersion) {
    lines.push(`ip ssh version ${device.sshVersion}`);
  }
  if (device.cdpEnabled === false) {
    lines.push('no cdp run');
  }
  if (device.lldpEnabled) {
    lines.push('lldp run');
  }
  if (device.users && device.users.length > 0) {
    device.users.forEach(u => {
      lines.push(
        `username ${u.username} secret ${device.servicePasswordEncryption ? '5 $1$enc$' : u.secret}`
      );
    });
  }
  lines.push('!');

  if (device.dhcpExcludedRanges && device.dhcpExcludedRanges.length > 0) {
    device.dhcpExcludedRanges.forEach(r => {
      lines.push(
        r.end
          ? `ip dhcp excluded-address ${r.start} ${r.end}`
          : `ip dhcp excluded-address ${r.start}`
      );
    });
    lines.push('!');
  }

  if (device.dhcpPools && device.dhcpPools.length > 0) {
    device.dhcpPools.forEach(pool => {
      lines.push(`ip dhcp pool ${pool.name}`);
      if (pool.network && pool.mask) {
        lines.push(` network ${pool.network} ${pool.mask}`);
      }
      if (pool.defaultRouter) {
        lines.push(` default-router ${pool.defaultRouter}`);
      }
      if (pool.dnsServer) {
        lines.push(` dns-server ${pool.dnsServer}`);
      }
      if (pool.domainName) {
        lines.push(` domain-name ${pool.domainName}`);
      }
      if (pool.lease) {
        lines.push(` lease ${pool.lease}`);
      }
      lines.push('!');
    });
  }

  if (device.type === 'switch') {
    device.vlans
      .filter(v => v.id !== 1)
      .forEach(v => {
        lines.push(`vlan ${v.id}`, ` name ${v.name}`, '!');
      });
  }

  device.interfaces.forEach(iface => {
    lines.push(`interface ${iface.name}`);
    if (iface.description) {
      lines.push(` description ${iface.description}`);
    }
    if (iface.dot1qVlan && iface.kind === 'subinterface') {
      lines.push(` encapsulation dot1Q ${iface.dot1qVlan}`);
    }
    if (iface.ip) {
      lines.push(` ip address ${iface.ip} ${iface.mask}`);
    }
    if (iface.ipAccessGroupIn) {
      lines.push(` ip access-group ${iface.ipAccessGroupIn} in`);
    }
    if (iface.ipAccessGroupOut) {
      lines.push(` ip access-group ${iface.ipAccessGroupOut} out`);
    }
    if (iface.cdpEnabled === false) {
      lines.push(' no cdp enable');
    }
    if (iface.bandwidth) {
      lines.push(` bandwidth ${iface.bandwidth}`);
    }
    if (iface.clockRate) {
      lines.push(` clock rate ${iface.clockRate}`);
    }
    if (iface.duplex && iface.duplex !== 'auto') {
      lines.push(` duplex ${iface.duplex}`);
    }
    if (iface.speed && iface.speed !== 'auto') {
      lines.push(` speed ${iface.speed}`);
    }
    if (device.type === 'switch' && iface.kind !== 'svi') {
      if (iface.switchportMode === 'trunk') {
        lines.push(' switchport mode trunk');
        if (iface.trunkNativeVlan && iface.trunkNativeVlan !== 1) {
          lines.push(` switchport trunk native vlan ${iface.trunkNativeVlan}`);
        }
        if (iface.trunkAllowedVlans && iface.trunkAllowedVlans.length > 0) {
          lines.push(` switchport trunk allowed vlan ${iface.trunkAllowedVlans.join(',')}`);
        }
      } else {
        lines.push(' switchport mode access');
        if (iface.accessVlan && iface.accessVlan !== 1) {
          lines.push(` switchport access vlan ${iface.accessVlan}`);
        }
      }
      if (iface.portSecurity?.enabled) {
        lines.push(' switchport port-security');
        if (iface.portSecurity.maximum !== 1) {
          lines.push(` switchport port-security maximum ${iface.portSecurity.maximum}`);
        }
        if (iface.portSecurity.violation !== 'shutdown') {
          lines.push(` switchport port-security violation ${iface.portSecurity.violation}`);
        }
        if (iface.portSecurity.sticky) {
          lines.push(' switchport port-security mac-address sticky');
        }
      }
      if (iface.portfast) {
        lines.push(' spanning-tree portfast');
      }
      if (iface.bpduGuard) {
        lines.push(' spanning-tree bpduguard enable');
      }
    }
    if (!iface.adminUp) {
      lines.push(' shutdown');
    }
    lines.push('!');
  });

  if (device.type === 'switch' && device.defaultGateway) {
    lines.push(`ip default-gateway ${device.defaultGateway}`, '!');
  }

  device.staticRoutes.forEach(sr => {
    lines.push(`ip route ${sr.network} ${sr.mask} ${sr.nextHop}`);
  });
  if (device.staticRoutes.length > 0) lines.push('!');

  if (device.ospf) {
    lines.push(`router ospf ${device.ospf.processId}`);
    if (device.ospf.routerId) {
      lines.push(` router-id ${device.ospf.routerId}`);
    }
    if (device.ospf.referenceBandwidth) {
      lines.push(` auto-cost reference-bandwidth ${device.ospf.referenceBandwidth}`);
    }
    if (device.ospf.passiveDefault) {
      lines.push(' passive-interface default');
    }
    (device.ospf.passiveInterfaces || []).forEach(pIf => {
      lines.push(` passive-interface ${pIf}`);
    });
    device.ospf.networks.forEach(n => {
      lines.push(` network ${n.network} ${n.wildcard} area ${n.area}`);
    });
    if (device.ospf.defaultInformationOriginate) {
      lines.push(' default-information originate');
    }
    lines.push('!');
  }

  if (device.accessLists && device.accessLists.length > 0) {
    device.accessLists.forEach(acl => {
      const isNumeric = /^\d+$/.test(acl.id);
      if (isNumeric) {
        acl.entries.forEach(entry => {
          lines.push(`access-list ${acl.id} ${entry}`);
        });
      } else {
        lines.push(`ip access-list ${acl.type} ${acl.id}`);
        acl.entries.forEach(entry => {
          lines.push(` ${entry}`);
        });
      }
      lines.push('!');
    });
  }

  if (device.ntpServer) {
    lines.push(`ntp server ${device.ntpServer}`, '!');
  }

  if (device.bannerMotd) {
    lines.push(`banner motd ^C${device.bannerMotd}^C`, '!');
  }

  const con = device.lineConfig?.console;
  lines.push('line con 0');
  if (con?.password) {
    lines.push(
      ` password ${device.servicePasswordEncryption ? '7 0822455D0A16' : con.password}`
    );
  }
  if (con?.execTimeout) lines.push(` exec-timeout ${con.execTimeout}`);
  if (con?.loggingSync) lines.push(' logging synchronous');
  if (con?.loginLocal) lines.push(' login local');
  else if (con?.login) lines.push(' login');

  const vty = device.lineConfig?.vty;
  lines.push('line vty 0 4');
  if (vty?.password) {
    lines.push(
      ` password ${device.servicePasswordEncryption ? '7 0822455D0A16' : vty.password}`
    );
  }
  if (vty?.execTimeout) lines.push(` exec-timeout ${vty.execTimeout}`);
  if (vty?.loggingSync) lines.push(' logging synchronous');
  if (vty?.loginLocal) lines.push(' login local');
  else if (vty?.login) lines.push(' login');
  if (vty?.transportInput) lines.push(` transport input ${vty.transportInput}`);

  lines.push('!', 'end');
  return lines;
}

export function buildShowVersionLines(device: SimDevice): string[] {
  const isRouter = device.type === 'router';
  const gigCount = device.interfaces.filter(i => i.name.startsWith('GigabitEthernet')).length;
  const faCount = device.interfaces.filter(i => i.name.startsWith('FastEthernet')).length;
  const serialCount = device.interfaces.filter(i => i.name.startsWith('Serial')).length;

  return [
    isRouter
      ? 'Cisco IOS XE Software, Version 16.09.04 (ISR4331/K9)'
      : 'Cisco IOS Software, C2960 Software (C2960-LANBASEK9-M), Version 15.2(4)E',
    `System image file is "flash:${isRouter ? 'isr4300-universalk9.16.09.04.SPA.bin' : 'c2960-lanbasek9-mz.152-4.E.bin'}"`,
    `${device.name} uptime is 1 hour, 24 minutes`,
    `Processor board ID FDO${device.id.slice(-6).toUpperCase().padEnd(6, '0')}`,
    ...(faCount > 0 ? [`${faCount} FastEthernet interfaces`] : []),
    ...(gigCount > 0 ? [`${gigCount} Gigabit Ethernet interfaces`] : []),
    ...(serialCount > 0 ? [`${serialCount} Serial interfaces`] : []),
    isRouter
      ? '32768K bytes of non-volatile configuration memory.'
      : '64K bytes of flash-simulated non-volatile configuration memory.',
    'Configuration register is 0x2102'
  ];
}

export function expandInterfaceToken(token: string): string {
  const norm = token.trim().toLowerCase().replace(/\s+/g, '');
  if (/^lo(opback)?\d+$/.test(norm)) {
    return norm.replace(/^lo(opback)?/, 'loopback');
  }
  if (/^vl(an)?\d+$/.test(norm)) {
    return norm.replace(/^vl(an)?/, 'vlan');
  }
  if (/^te(n|ngigabitethernet)?(\d)/.test(norm)) {
    return norm.replace(/^te(n|ngigabitethernet)?/, 'tengigabitethernet');
  }
  if (/^g(\d)/.test(norm)) return norm.replace(/^g/, 'gigabitethernet');
  if (/^gi(\d)/.test(norm)) return norm.replace(/^gi/, 'gigabitethernet');
  if (/^gig(\d)/.test(norm)) return norm.replace(/^gig/, 'gigabitethernet');
  if (/^f(\d)/.test(norm)) return norm.replace(/^f/, 'fastethernet');
  if (/^fa(\d)/.test(norm)) return norm.replace(/^fa/, 'fastethernet');
  if (/^eth?(\d)/.test(norm)) return norm.replace(/^eth?/, 'ethernet');
  if (/^s(\d)/.test(norm)) return norm.replace(/^s/, 'serial');
  if (/^se(\d)/.test(norm)) return norm.replace(/^se/, 'serial');
  return norm;
}

export function parseInterfaceRangeSpec(
  device: SimDevice,
  rawSpec: string
): SimDeviceInterface[] {
  const matched: SimDeviceInterface[] = [];
  const segments = rawSpec
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);

  for (const seg of segments) {
    // Support forms like: "fa0/1 - 4", "fa0/1-4", "gig0/1 - 2", "fa0/1"
    const cleaned = seg.replace(/\s*-\s*/g, '-').replace(/\s+/g, '');
    const rangeMatch = cleaned.match(/^([a-zA-Z]+[\d/]*\/)(\d+)-(\d+)$/);
    if (rangeMatch) {
      const prefixRaw = rangeMatch[1];
      const startNum = Number(rangeMatch[2]);
      const endNum = Number(rangeMatch[3]);
      if (Number.isInteger(startNum) && Number.isInteger(endNum) && endNum >= startNum) {
        for (let n = startNum; n <= endNum; n++) {
          const expanded = expandInterfaceToken(`${prefixRaw}${n}`);
          const found = device.interfaces.find(
            i =>
              i.name.toLowerCase() === expanded ||
              i.shortName.toLowerCase() === expanded
          );
          if (found && !matched.some(m => m.name === found.name)) {
            matched.push(found);
          }
        }
      }
      continue;
    }

    const singleExpanded = expandInterfaceToken(cleaned);
    const single = device.interfaces.find(
      i =>
        i.name.toLowerCase() === singleExpanded ||
        i.shortName.toLowerCase() === singleExpanded
    );
    if (single && !matched.some(m => m.name === single.name)) {
      matched.push(single);
    }
  }

  return matched;
}

export function applyCiscoPipeFilter(lines: string[], pipeExprRaw: string): string[] {
  const pipeExpr = pipeExprRaw.trim();
  if (!pipeExpr) return lines;
  const parts = pipeExpr.split(/\s+/);
  const modifier = (parts[0] || '').toLowerCase();
  const pattern = parts.slice(1).join(' ').trim();
  if (!pattern) {
    return ['% Incomplete pipe filter. Usage: | include|exclude|begin|section <pattern>'];
  }
  const needle = pattern.toLowerCase();

  if (modifier === 'i' || 'include'.startsWith(modifier)) {
    const out = lines.filter(l => l.toLowerCase().includes(needle));
    return out.length > 0 ? out : [`% No lines matched "| include ${pattern}".`];
  }
  if (modifier === 'e' || modifier === 'ex' || 'exclude'.startsWith(modifier)) {
    return lines.filter(l => !l.toLowerCase().includes(needle));
  }
  if (modifier === 'b' || 'begin'.startsWith(modifier)) {
    const idx = lines.findIndex(l => l.toLowerCase().includes(needle));
    return idx >= 0 ? lines.slice(idx) : [`% Pattern "${pattern}" not found in output.`];
  }
  if (modifier === 's' || 'section'.startsWith(modifier)) {
    const out: string[] = [];
    let inSection = false;
    for (const line of lines) {
      const isTopLevel = line.length > 0 && !line.startsWith(' ') && line !== '!';
      if (isTopLevel) {
        inSection = line.toLowerCase().includes(needle);
      } else if (line === '!') {
        if (inSection) out.push('!');
        inSection = false;
        continue;
      }
      if (inSection) out.push(line);
    }
    return out.length > 0 ? out : [`% No section matching "${pattern}" found.`];
  }

  return [`% Invalid pipe modifier "${parts[0]}". Supported: include, exclude, begin, section.`];
}

export function getCliHelpLines(device: SimDevice, rawQuery?: string): string[] {
  const prefix = (rawQuery || '')
    .replace(/\?$/, '')
    .trim()
    .toLowerCase();

  if (prefix) {
    const { suggestions } = getCliTabCompletions(device, `${prefix} `);
    if (suggestions.length > 0) {
      return [
        `Matches for "${prefix} ?":`,
        ...suggestions.map(s => `  ${s}`)
      ];
    }
    const modeLines = getCliHelpLines(device);
    const matching = modeLines.filter(l => l.toLowerCase().includes(prefix));
    if (matching.length > 0) {
      return [`Context help for "${prefix}":`, ...matching];
    }
  }

  if (device.cliMode === 'user') {
    return [
      'User EXEC Commands:',
      '  enable (en)                   - Turn on Privileged EXEC commands',
      '  ping <ip>                     - Send ICMP echo requests',
      '  traceroute <ip>               - Trace route to destination',
      '  show version / show clock     - Display system hardware & clock',
      '  show ip interface brief       - Brief summary of IP interfaces',
      '  exit / clear                  - Exit session or clear screen'
    ];
  }

  if (device.cliMode === 'global') {
    return [
      'Global Configuration Commands (use "do <show|ping|wr>" anytime):',
      '  hostname <name>               - Set system network name',
      '  interface <name> (int g0/0)   - Configure single interface / Lo0 / Vlan',
      '  interface range <spec>        - Configure port range (e.g. int range fa0/1-4)',
      '  banner motd ^<msg>^           - Configure message-of-the-day banner',
      '  enable secret <password>      - Assign encrypted enable secret',
      '  service password-encryption   - Encrypt plaintext line passwords',
      '  no ip domain-lookup           - Disable DNS hostname lookup',
      '  ip domain-name <domain>       - Configure DNS / SSH domain name',
      '  crypto key generate rsa       - Generate RSA keypair for SSHv2',
      '  ip ssh version 2              - Enforce SSHv2 management protocol',
      '  username <user> secret <pw>   - Create local AAA user credential',
      '  line console 0 / line vty 0 4 - Enter console or VTY line configuration',
      '  access-list <1-199> ...       - Define numbered standard/extended ACL',
      '  ip access-list standard|extended <name>',
      '  cdp run / lldp run            - Enable or disable L2 neighbor discovery',
      '  ntp server <ip>               - Configure NTP synchronization server',
      ...(device.type === 'router'
        ? [
            '  ip route <net> <mask> <nh>    - Add IPv4 static route',
            '  router ospf <pid>             - Configure OSPF routing process',
            '  ip dhcp pool <name>           - Configure IOS DHCP server pool',
            '  ip dhcp excluded-address <ip> [end]'
          ]
        : [
            '  vlan <id> / no vlan <id>      - Create or remove VLAN database entry',
            '  ip default-gateway <ip>       - Set switch L2 management gateway'
          ]),
      '  exit / end (Ctrl+Z)           - Step back or return to Privileged EXEC'
    ];
  }

  if (device.cliMode === 'interface' || device.cliMode === 'interface_range') {
    return [
      `Interface ${device.cliMode === 'interface_range' ? 'Range ' : ''}Configuration Commands:`,
      '  description <text>            - Set interface description',
      '  no shutdown / shutdown        - Administratively enable or disable port',
      '  duplex auto|full|half         - Configure interface duplex operation',
      '  speed auto|10|100|1000        - Configure interface speed (Mbps)',
      '  ip access-group <acl> in|out  - Apply ACL filter to interface traffic',
      '  cdp enable / no cdp enable    - Toggle CDP per interface',
      ...(device.type === 'router'
        ? [
            '  ip address <ip> <mask>        - Assign IPv4 address (single interface)',
            '  encapsulation dot1q <vlan>    - Configure 802.1Q VLAN tagging',
            '  bandwidth <kbps> / clock rate - Configure serial WAN parameters'
          ]
        : [
            '  switchport mode access|trunk  - Set L2 access or 802.1Q trunk mode',
            '  switchport access vlan <id>   - Assign access VLAN',
            '  switchport trunk native vlan <id>',
            '  switchport trunk allowed vlan <list|add|remove>',
            '  switchport port-security [maximum <n>|violation ...|mac-address sticky]',
            '  spanning-tree portfast / bpduguard enable'
          ]),
      '  do <cmd> / exit / end         - Run EXEC command or exit interface mode'
    ];
  }

  if (device.cliMode === 'router_ospf') {
    return [
      'OSPF Router Configuration Commands:',
      '  router-id <x.x.x.x>           - Set 32-bit OSPF Router ID',
      '  network <net> <wild> area <n> - Advertise IP prefix into OSPF area',
      '  passive-interface <if|default>- Suppress OSPF Hellos on interface',
      '  default-information originate - Advertise default route into OSPF',
      '  auto-cost reference-bandwidth <mbps>',
      '  exit / end                    - Return to Global or Privileged mode'
    ];
  }

  if (device.cliMode === 'dhcp_pool') {
    return [
      'DHCP Pool Configuration Commands:',
      '  network <net> <mask>          - Configure DHCP IPv4 subnet pool',
      '  default-router <ip>           - Assign client default gateway',
      '  dns-server <ip>               - Assign DNS resolver IP',
      '  domain-name <domain>          - Assign DHCP DNS domain suffix',
      '  lease <days|infinite>         - Configure address lease duration',
      '  exit / end                    - Return to Global or Privileged mode'
    ];
  }

  if (device.cliMode === 'acl') {
    return [
      'Named Access-List Configuration Commands:',
      '  permit <source|any|host ip>   - Add permit ACE rule',
      '  deny <source|any|host ip>     - Add deny ACE rule',
      '  remark <comment>              - Add descriptive ACL remark',
      '  no <rule>                     - Remove matching ACE rule',
      '  exit / end                    - Return to Global or Privileged mode'
    ];
  }

  if (device.cliMode === 'vlan_db') {
    return [
      'VLAN Configuration Commands:',
      '  name <vlan-name>              - Assign descriptive name to VLAN',
      '  exit / end                    - Save VLAN and return'
    ];
  }

  if (device.cliMode === 'line') {
    return [
      'Line Configuration Commands:',
      '  password <pw>                 - Set console/VTY password',
      '  login / login local           - Enable password or local user login',
      '  transport input ssh|telnet|all|none',
      '  exec-timeout <min> [sec]      - Set idle EXEC timeout',
      '  logging synchronous           - Prevent console log interruption',
      '  exit / end                    - Return to Global or Privileged mode'
    ];
  }

  // Privileged EXEC
  return [
    'Privileged EXEC Commands (supports "| include|exclude|begin|section <pat>"):',
    '  configure terminal (conf t)   - Enter Global Configuration mode',
    '  show running-config (sh run)  - Display active configuration',
    '  show startup-config (sh start)- Display saved NVRAM configuration',
    '  copy running-config startup-config (wr)',
    '  show version (sh ver)         - Hardware, IOS version & interface summary',
    '  show ip interface brief       - Interface IP & up/up protocol summary',
    '  show interfaces [name|desc]   - Detailed interface stats & descriptions',
    '  show cdp [neighbors [detail]] - Live adjacent Cisco neighbor table',
    '  show lldp neighbors           - Live LLDP neighbor table',
    '  show arp / show ip arp        - L2-resolved IP-to-MAC ARP table',
    '  show access-lists             - Configured IPv4 standard/extended ACLs',
    '  show ip ssh / show ntp status - Management SSHv2 & NTP status',
    '  show history / show users     - Session command history & lines',
    ...(device.type === 'router'
      ? [
          '  show ip route [static|ospf]   - IPv4 routing table',
          '  show ip protocols             - Active OSPF routing configuration',
          '  show ip ospf [neighbor|int|database]',
          '  show ip dhcp pool / binding   - DHCP server pools & active bindings',
          '  clear ip ospf process / arp-cache'
        ]
      : [
          '  show vlan brief / id <n>      - VLAN membership & active ports',
          '  show interfaces trunk         - Active 802.1Q trunk ports',
          '  show interfaces switchport    - Switchport access/trunk settings',
          '  show interfaces status        - Switchport link/speed/VLAN summary',
          '  show port-security [int <if>] - Port-security violations & limits',
          '  show mac address-table        - Dynamically learned MAC addresses',
          '  show spanning-tree            - Spanning-Tree root & port states'
        ]),
    '  ping <ip> / traceroute <ip>   - Verify live topology connectivity',
    '  disable / exit / clear        - Exit Privileged mode or clear screen'
  ];
}

export function getCliTabCompletions(
  device: SimDevice,
  rawInput: string
): { completed: string; suggestions: string[] } {
  const trimmedLeft = rawInput.replace(/^\s+/, '');
  const hasTrailingSpace = /\s$/.test(rawInput);
  const parts = trimmedLeft ? trimmedLeft.split(/\s+/) : [];

  if (device.type === 'pc' || device.type === 'server') {
    const pcCmds = ['ipconfig', 'ipconfig /all', 'ping', 'tracert', 'traceroute', 'clear', 'help'];
    if (parts.length <= 1 && !hasTrailingSpace) {
      const q = (parts[0] || '').toLowerCase();
      const matches = pcCmds.filter(c => c.startsWith(q));
      if (matches.length === 1) {
        return { completed: `${matches[0]} `, suggestions: [] };
      }
      return { completed: rawInput, suggestions: matches };
    }
    return { completed: rawInput, suggestions: [] };
  }

  const privilegedShowCandidates = [
    'show running-config',
    'show startup-config',
    'show version',
    'show ip interface brief',
    'show ip interface',
    'show interfaces',
    'show interfaces description',
    ...(device.type === 'router'
      ? [
          'show ip route',
          'show ip protocols',
          'show ip ospf',
          'show ip ospf neighbor',
          'show ip ospf interface',
          'show ip ospf database',
          'show ip dhcp pool',
          'show ip dhcp binding'
        ]
      : [
          'show interfaces status',
          'show interfaces switchport',
          'show interfaces trunk',
          'show port-security',
          'show vlan brief',
          'show mac address-table',
          'show spanning-tree'
        ]),
    'show access-lists',
    'show ip ssh',
    'show cdp',
    'show cdp neighbors',
    'show cdp neighbors detail',
    'show lldp neighbors',
    'show arp',
    'show ntp status',
    'show users',
    'show history',
    'show clock'
  ];

  // Interface completion inside `show interfaces <partial>` or `show ip int <partial>`
  const lowerTrim = trimmedLeft.toLowerCase();
  if (
    (lowerTrim.startsWith('show interfaces ') ||
      lowerTrim.startsWith('sh int ') ||
      lowerTrim.startsWith('show ip interface ') ||
      lowerTrim.startsWith('sh ip int ') ||
      lowerTrim.startsWith('do show interfaces ')) &&
    !hasTrailingSpace
  ) {
    const lastToken = (parts[parts.length - 1] || '').toLowerCase();
    const extraKw = device.type === 'switch' ? ['status', 'switchport', 'trunk', 'description'] : ['description'];
    const ifPool = [...extraKw, ...device.interfaces.map(i => i.name)];
    const matches = ifPool.filter(n => n.toLowerCase().startsWith(lastToken));
    if (matches.length === 1) {
      const prefixTokens = parts.slice(0, -1).join(' ');
      return { completed: `${prefixTokens} ${matches[0]} `, suggestions: [] };
    }
    if (matches.length > 1) {
      return { completed: rawInput, suggestions: matches };
    }
  }

  let candidates: string[] = [];
  if (device.cliMode === 'user') {
    candidates = ['enable', 'ping', 'traceroute', 'show ip interface brief', 'show version', 'show clock', 'exit', 'clear', 'help'];
  } else if (device.cliMode === 'privileged') {
    candidates = [
      'configure terminal',
      'copy running-config startup-config',
      'write memory',
      'erase startup-config',
      'disable',
      'ping',
      'traceroute',
      'clear ip ospf process',
      'clear arp-cache',
      'clear mac address-table dynamic',
      ...privilegedShowCandidates,
      'terminal length',
      'clear',
      'exit'
    ];
  } else if (device.cliMode === 'global') {
    candidates = [
      'hostname',
      'interface',
      'interface range',
      'banner motd',
      'enable secret',
      'service password-encryption',
      'no service password-encryption',
      'no ip domain-lookup',
      'ip domain-name',
      'ip name-server',
      'crypto key generate rsa',
      'ip ssh version 2',
      'cdp run',
      'no cdp run',
      'lldp run',
      'no lldp run',
      'ntp server',
      'access-list',
      'ip access-list standard',
      'ip access-list extended',
      'username',
      'line console 0',
      'line vty 0 4',
      ...(device.type === 'router'
        ? [
            'ip route',
            'no ip route',
            'router ospf',
            'no router ospf',
            'ip dhcp pool',
            'ip dhcp excluded-address'
          ]
        : ['vlan', 'no vlan', 'ip default-gateway']),
      ...privilegedShowCandidates.map(s => `do ${s}`),
      'do write memory',
      'exit',
      'end'
    ];
  } else if (device.cliMode === 'interface' || device.cliMode === 'interface_range') {
    candidates = [
      'description',
      'no description',
      'shutdown',
      'no shutdown',
      'duplex',
      'speed',
      'ip access-group',
      'cdp enable',
      'no cdp enable',
      ...(device.type === 'router'
        ? ['ip address', 'no ip address', 'encapsulation dot1q', 'bandwidth', 'clock rate']
        : [
            'switchport mode access',
            'switchport mode trunk',
            'switchport access vlan',
            'switchport trunk native vlan',
            'switchport trunk allowed vlan',
            'switchport port-security',
            'switchport port-security maximum',
            'switchport port-security violation',
            'switchport port-security mac-address sticky',
            'spanning-tree portfast',
            'spanning-tree bpduguard enable'
          ]),
      ...privilegedShowCandidates.map(s => `do ${s}`),
      'do write memory',
      'exit',
      'end'
    ];
  } else if (device.cliMode === 'router_ospf') {
    candidates = [
      'router-id',
      'network',
      'passive-interface',
      'no passive-interface',
      'default-information originate',
      'auto-cost reference-bandwidth',
      'do show ip ospf neighbor',
      'do show ip route',
      'exit',
      'end'
    ];
  } else if (device.cliMode === 'dhcp_pool') {
    candidates = ['network', 'default-router', 'dns-server', 'domain-name', 'lease', 'do show ip dhcp pool', 'exit', 'end'];
  } else if (device.cliMode === 'acl') {
    candidates = ['permit', 'deny', 'remark', 'do show access-lists', 'exit', 'end'];
  } else if (device.cliMode === 'vlan_db') {
    candidates = ['name', 'do show vlan brief', 'exit', 'end'];
  } else if (device.cliMode === 'line') {
    candidates = [
      'password',
      'login',
      'login local',
      'no login',
      'transport input',
      'exec-timeout',
      'logging synchronous',
      'exit',
      'end'
    ];
  }

  // Interface name completion after `interface ` or `int `
  if (
    device.cliMode !== 'user' &&
    device.cliMode !== 'privileged' &&
    parts.length >= 1 &&
    ('interface'.startsWith(parts[0].toLowerCase()) && parts[0].toLowerCase().startsWith('int'))
  ) {
    const partialIf = hasTrailingSpace ? '' : (parts[1] || '').toLowerCase();
    if (parts.length <= 2) {
      const ifNames = [
        ...device.interfaces.map(i => i.name),
        'Loopback0',
        ...(device.type === 'switch' ? ['Vlan1'] : []),
        'range'
      ];
      const uniqueIfNames = Array.from(new Set(ifNames));
      const matches = uniqueIfNames.filter(n => n.toLowerCase().startsWith(partialIf));
      if (matches.length === 1) {
        return { completed: `${parts[0]} ${matches[0]} `, suggestions: [] };
      }
      if (matches.length > 1) {
        return { completed: rawInput, suggestions: matches };
      }
    }
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
    const completed = prefix.length > trimmedLeft.length ? prefix : rawInput;
    return { completed, suggestions: matches };
  }

  return { completed: rawInput, suggestions: [] };
}

export function findDirectlyConnectedNeighbor(
  device: SimDevice,
  iface: SimDeviceInterface,
  allDevices: SimDevice[],
  allLinks: SimLink[]
): { link: SimLink; remoteDevice: SimDevice; remoteIface: SimDeviceInterface } | null {
  const portName = iface.parentInterface || iface.name;
  const link = allLinks.find(
    l =>
      (l.fromDeviceId === device.id && l.fromPort === portName) ||
      (l.toDeviceId === device.id && l.toPort === portName)
  );
  if (!link) return null;
  const remoteId = link.fromDeviceId === device.id ? link.toDeviceId : link.fromDeviceId;
  const remotePort = link.fromDeviceId === device.id ? link.toPort : link.fromPort;
  const remoteDevice = allDevices.find(d => d.id === remoteId);
  if (!remoteDevice) return null;
  const remoteIface = remoteDevice.interfaces.find(i => i.name === remotePort);
  if (!remoteIface) return null;
  return { link, remoteDevice, remoteIface };
}

function resolveShowVerbMatch(verb: string, targets: string[]): string | null {
  const exact = targets.find(t => t === verb);
  if (exact) return exact;
  const prefixMatches = targets.filter(t => t.startsWith(verb));
  return prefixMatches.length === 1 ? prefixMatches[0] : null;
}

export function executeCiscoShowCommand(
  device: SimDevice,
  lowerCmd: string,
  allDevices: SimDevice[],
  allLinks: SimLink[],
  deps: CiscoShowDeps
): string[] | null {
  // Split optional Cisco IOS output pipe modifier: e.g. `show run | section ospf`
  const pipeIdx = lowerCmd.indexOf('|');
  const baseLower = (pipeIdx >= 0 ? lowerCmd.slice(0, pipeIdx) : lowerCmd).trim();
  const pipeExpr = pipeIdx >= 0 ? lowerCmd.slice(pipeIdx + 1).trim() : '';

  const tokens = baseLower.split(/\s+/);
  if (!tokens[0] || !'show'.startsWith(tokens[0]) || tokens[0].length < 2) return null;

  const subTokens = tokens.slice(1);
  const sub = subTokens.join(' ');
  const firstSub = subTokens[0] || '';

  const finalize = (lines: string[] | null): string[] | null => {
    if (lines === null) return null;
    return pipeExpr ? applyCiscoPipeFilter(lines, pipeExpr) : lines;
  };

  if (subTokens.length === 0) {
    return ['% Incomplete command. Type "show ?" for show subcommands.'];
  }

  if (firstSub && 'version'.startsWith(firstSub) && subTokens.length === 1 && firstSub.length >= 2) {
    return finalize(buildShowVersionLines(device));
  }

  if (firstSub && 'clock'.startsWith(firstSub) && subTokens.length === 1 && firstSub.length >= 2) {
    return finalize([new Date().toUTCString()]);
  }

  if (firstSub && 'history'.startsWith(firstSub) && subTokens.length === 1 && firstSub.length >= 3) {
    const cmds = device.commandHistory && device.commandHistory.length > 0
      ? device.commandHistory.slice(-20)
      : [];
    return finalize(
      cmds.length > 0
        ? cmds.map((c, idx) => `  ${String(idx + 1).padStart(2, ' ')}  ${c}`)
        : ['  No commands recorded in current session history yet.']
    );
  }

  if (firstSub && 'users'.startsWith(firstSub) && subTokens.length === 1 && firstSub.length >= 2) {
    return finalize([
      '    Line       User       Host(s)              Idle       Location',
      `*  0 con 0                idle                 00:00:00   Local Console (${device.name})`
    ]);
  }

  if (firstSub === 'ntp' && (subTokens[1] === 'status' || subTokens[1] === 'associations')) {
    return finalize(
      device.ntpServer
        ? [
            `Clock is synchronized, stratum 2, reference is ${device.ntpServer}`,
            'nominal freq is 250.0000 Hz, actual freq is 250.0000 Hz, precision is 2**10'
          ]
        : ['Clock is unsynchronized. Configure with "ntp server <ip>".']
    );
  }

  if (sub === 'banner') {
    return finalize(
      device.bannerMotd
        ? ['MOTD Banner:', device.bannerMotd]
        : ['No MOTD banner configured.']
    );
  }

  if (
    subTokens.length === 1 &&
    firstSub.length >= 3 &&
    'running-config'.startsWith(firstSub)
  ) {
    return finalize(buildRunningConfigLines(device));
  }

  if (
    subTokens.length === 1 &&
    firstSub.length >= 2 &&
    'startup-config'.startsWith(firstSub)
  ) {
    if (!device.startupConfigLines || device.startupConfigLines.length === 0) {
      return finalize([
        '%% startup-config is not present (run "copy running-config startup-config" or "wr").'
      ]);
    }
    return finalize([
      `! Saved ${device.startupConfigSavedAt ? new Date(device.startupConfigSavedAt).toLocaleString() : 'NVRAM'}`,
      ...device.startupConfigLines
    ]);
  }

  if (
    sub === 'access-lists' ||
    sub === 'access-list' ||
    sub === 'ip access-lists' ||
    sub === 'ip access-list'
  ) {
    const acls = device.accessLists || [];
    if (acls.length === 0) {
      return finalize(['No IP access lists configured.']);
    }
    const out: string[] = [];
    acls.forEach(acl => {
      const label = acl.type === 'standard' ? 'Standard IP access list' : 'Extended IP access list';
      out.push(`${label} ${acl.id}`);
      acl.entries.forEach((entry, idx) => {
        out.push(`    ${(idx + 1) * 10} ${entry}`);
      });
    });
    return finalize(out);
  }

  if (sub === 'ip ssh' || sub === 'ssh') {
    const enabled = Boolean(device.domainName && (device.rsaKeyBits || 0) >= 768);
    return finalize([
      enabled
        ? `SSH Enabled - version ${device.sshVersion || 2}.0`
        : 'SSH Disabled - configure "ip domain-name" and "crypto key generate rsa"',
      'Authentication timeout: 120 secs; Authentication retries: 3',
      `RSA Key Modulus: ${device.rsaKeyBits ? `${device.rsaKeyBits} bits` : 'Not generated'}`
    ]);
  }

  if (
    subTokens[0] === 'ip' &&
    subTokens[1] &&
    'interface'.startsWith(subTokens[1]) &&
    subTokens[2] &&
    'brief'.startsWith(subTokens[2]) &&
    subTokens[2].length >= 2
  ) {
    const out = [
      'Interface                  IP-Address      OK? Method Status                Protocol'
    ];
    device.interfaces.forEach(iface => {
      const linkUp = deps.isIfUp(device, iface);
      const statusText = iface.adminUp ? (linkUp ? 'up' : 'down') : 'administratively down';
      const protoText = iface.adminUp && linkUp ? 'up' : 'down';
      const ipDisplay = iface.ip || 'unassigned';
      out.push(
        `${iface.name.padEnd(27, ' ')}${ipDisplay.padEnd(16, ' ')}YES manual ${statusText.padEnd(22, ' ')}${protoText}`
      );
    });
    return finalize(out);
  }

  if (subTokens[0] === 'ip' && subTokens[1] && 'interface'.startsWith(subTokens[1]) && subTokens[1].length >= 3) {
    const targetToken = subTokens.slice(2).join('');
    const list = targetToken
      ? device.interfaces.filter(
          i =>
            i.name.toLowerCase() === expandInterfaceToken(targetToken) ||
            i.shortName.toLowerCase() === targetToken
        )
      : device.interfaces;
    if (list.length === 0) return finalize([`% Invalid interface "${targetToken}".`]);
    const out: string[] = [];
    list.forEach(iface => {
      const up = deps.isIfUp(device, iface);
      out.push(
        `${iface.name} is ${iface.adminUp ? (up ? 'up' : 'down') : 'administratively down'}, line protocol is ${up ? 'up' : 'down'}`
      );
      if (iface.ip) {
        out.push(`  Internet address is ${iface.ip}/${iface.mask}`);
      } else {
        out.push('  Internet protocol processing disabled');
      }
      out.push(
        `  Inbound  access list is ${iface.ipAccessGroupIn || 'not set'}`,
        `  Outgoing access list is ${iface.ipAccessGroupOut || 'not set'}`,
        `  MTU is 1500 bytes`
      );
    });
    return finalize(out);
  }

  if (
    subTokens[0] === 'port-security' ||
    sub.startsWith('port-security ')
  ) {
    if (device.type !== 'switch') {
      return finalize(['% Port Security is supported on Catalyst switches.']);
    }
    const ifArg =
      subTokens[1] && 'interface'.startsWith(subTokens[1])
        ? subTokens.slice(2).join('')
        : '';
    if (ifArg) {
      const expanded = expandInterfaceToken(ifArg);
      const iface = device.interfaces.find(
        i => i.name.toLowerCase() === expanded || i.shortName.toLowerCase() === ifArg
      );
      if (!iface) return finalize([`% Invalid interface "${ifArg}".`]);
      const ps = iface.portSecurity;
      const nb = findDirectlyConnectedNeighbor(device, iface, allDevices, allLinks);
      return finalize([
        `Port Security              : ${ps?.enabled ? 'Enabled' : 'Disabled'}`,
        `Port Status                : ${ps?.enabled && deps.isIfUp(device, iface) ? 'Secure-up' : 'Secure-down'}`,
        `Violation Mode             : ${ps?.violation || 'shutdown'}`,
        `Maximum MAC Addresses      : ${ps?.maximum || 1}`,
        `Sticky MAC Addresses       : ${ps?.sticky ? 'Enabled' : 'Disabled'}`,
        `Last Source Address:Vlan   : ${nb ? `${nb.remoteIface.mac}:${iface.accessVlan || 1}` : '0000.0000.0000:0'}`
      ]);
    }
    const secured = device.interfaces.filter(i => i.portSecurity?.enabled);
    if (secured.length === 0) {
      return finalize(['No interfaces currently have port-security enabled.']);
    }
    const out = [
      'Secure Port  MaxSecureAddr  CurrentAddr  SecurityViolation  Security Action',
      '               (Count)       (Count)          (Count)',
      '---------------------------------------------------------------------------'
    ];
    secured.forEach(iface => {
      const ps = iface.portSecurity!;
      const nb = findDirectlyConnectedNeighbor(device, iface, allDevices, allLinks);
      const curr = nb && deps.isIfUp(device, iface) ? 1 : 0;
      out.push(
        `${iface.shortName.padEnd(13, ' ')}${String(ps.maximum).padEnd(15, ' ')}${String(curr).padEnd(13, ' ')}0                  ${ps.violation}`
      );
    });
    return finalize(out);
  }

  if (
    subTokens[0] &&
    'interfaces'.startsWith(subTokens[0]) &&
    subTokens[0].length >= 3 &&
    subTokens[1] &&
    'description'.startsWith(subTokens[1]) &&
    subTokens[1].length >= 4
  ) {
    const out = [
      'Interface                      Status         Protocol Description'
    ];
    device.interfaces.forEach(iface => {
      const up = deps.isIfUp(device, iface);
      const status = !iface.adminUp ? 'admin down' : up ? 'up' : 'down';
      const proto = iface.adminUp && up ? 'up' : 'down';
      out.push(
        `${iface.shortName.padEnd(31, ' ')}${status.padEnd(15, ' ')}${proto.padEnd(9, ' ')}${iface.description || ''}`
      );
    });
    return finalize(out);
  }

  if (
    subTokens[0] &&
    'interfaces'.startsWith(subTokens[0]) &&
    subTokens[0].length >= 3 &&
    subTokens[1] &&
    'status'.startsWith(subTokens[1]) &&
    subTokens[1].length >= 2
  ) {
    if (device.type !== 'switch') {
      return finalize(['% "show interfaces status" is supported on Catalyst switches.']);
    }
    const out = [
      'Port      Name               Status       Vlan       Duplex  Speed Type'
    ];
    device.interfaces
      .filter(i => i.kind !== 'svi')
      .forEach(iface => {
        const up = deps.isIfUp(device, iface);
        const status = !iface.adminUp ? 'disabled' : up ? 'connected' : 'notconnect';
        const vlanCol = iface.switchportMode === 'trunk' ? 'trunk' : String(iface.accessVlan || 1);
        const dup = iface.duplex || (up ? 'a-full' : 'auto');
        const spd = iface.speed || (iface.name.startsWith('Gig') ? 'a-1000' : 'a-100');
        const desc = (iface.description || '').slice(0, 18);
        out.push(
          `${iface.shortName.padEnd(10, ' ')}${desc.padEnd(19, ' ')}${status.padEnd(13, ' ')}${vlanCol.padEnd(11, ' ')}${dup.padEnd(8, ' ')}${spd.padEnd(6, ' ')}10/100/1000`
        );
      });
    return finalize(out);
  }

  if (
    subTokens[0] &&
    'interfaces'.startsWith(subTokens[0]) &&
    subTokens[0].length >= 3 &&
    subTokens[1] &&
    'switchport'.startsWith(subTokens[1]) &&
    subTokens[1].length >= 2
  ) {
    if (device.type !== 'switch') {
      return finalize(['% Switchport parameters apply to Catalyst switches.']);
    }
    const out: string[] = [];
    device.interfaces
      .filter(i => i.kind !== 'svi')
      .forEach(iface => {
        const mode = iface.switchportMode === 'trunk' ? 'trunk' : 'static access';
        out.push(
          `Name: ${iface.shortName}`,
          `Switchport: Enabled`,
          `Administrative Mode: ${mode}`,
          `Operational Mode: ${iface.adminUp ? mode : 'down'}`,
          `Access Mode VLAN: ${iface.accessVlan || 1}`,
          `Trunking Native Mode VLAN: ${iface.trunkNativeVlan || 1}`,
          `Trunking VLANs Enabled: ${(iface.trunkAllowedVlans || [1]).join(',')}`,
          ''
        );
      });
    return finalize(out);
  }

  if (
    subTokens[0] &&
    'interfaces'.startsWith(subTokens[0]) &&
    subTokens[0].length >= 3 &&
    subTokens[1] &&
    'trunk'.startsWith(subTokens[1]) &&
    subTokens[1].length >= 2
  ) {
    if (device.type !== 'switch') {
      return finalize(['% Trunk status applies to Catalyst switches.']);
    }
    const trunks = device.interfaces.filter(i => i.switchportMode === 'trunk');
    if (trunks.length === 0) return finalize(['No active 802.1Q trunk ports configured.']);
    const out = [
      'Port        Mode         Encapsulation  Status        Native vlan'
    ];
    trunks.forEach(t => {
      const isUp = deps.isIfUp(device, t);
      out.push(
        `${t.shortName.padEnd(12, ' ')}on           802.1q         ${(isUp ? 'trunking' : 'notconnect').padEnd(14, ' ')}${t.trunkNativeVlan || 1}`
      );
    });
    out.push('', 'Port        Vlans allowed on trunk');
    trunks.forEach(t => {
      out.push(`${t.shortName.padEnd(12, ' ')}${(t.trunkAllowedVlans || [1]).join(',')}`);
    });
    return finalize(out);
  }

  if (subTokens[0] && 'interfaces'.startsWith(subTokens[0]) && subTokens[0].length >= 3) {
    const targetToken = subTokens.slice(1).join('');
    const list = targetToken
      ? device.interfaces.filter(
          i =>
            i.name.toLowerCase() === expandInterfaceToken(targetToken) ||
            i.shortName.toLowerCase() === targetToken
        )
      : device.interfaces;
    if (list.length === 0) return finalize([`% Invalid interface "${targetToken}".`]);
    const out: string[] = [];
    list.forEach(iface => {
      const up = deps.isIfUp(device, iface);
      const state = iface.adminUp ? (up ? 'up' : 'down') : 'administratively down';
      out.push(`${iface.name} is ${state}, line protocol is ${up ? 'up' : 'down'}`);
      out.push(`  Hardware is ${iface.kind.toUpperCase()}, address is ${iface.mac}`);
      if (iface.description) out.push(`  Description: ${iface.description}`);
      if (iface.ip) out.push(`  Internet address is ${iface.ip}/${iface.mask}`);
      out.push(
        `  MTU 1500 bytes, BW ${iface.bandwidth || (iface.kind === 'serial' ? 1544 : iface.name.startsWith('Gig') ? 1000000 : 100000)} Kbit/sec, ${iface.duplex || 'Auto'}-duplex, ${iface.speed || 'Auto'}-speed`
      );
      if (iface.kind === 'subinterface' && iface.dot1qVlan) {
        out.push(`  Encapsulation 802.1Q Virtual LAN, Vlan ID ${iface.dot1qVlan}.`);
      }
      out.push(`     5 minute input rate 0 bits/sec, 0 packets/sec`);
    });
    return finalize(out);
  }

  if (subTokens[0] === 'ip' && subTokens[1] && 'route'.startsWith(subTokens[1]) && subTokens[1].length >= 2) {
    if (device.type !== 'router') {
      return finalize(['% Routing table applies to Layer 3 routers.']);
    }
    const mod = subTokens[2] || '';
    const filterCode = mod
      ? 'connected'.startsWith(mod)
        ? 'C'
        : 'static'.startsWith(mod)
        ? 'S'
        : 'ospf'.startsWith(mod)
        ? 'O'
        : null
      : null;
    const table = deps.computeRoutes(device).filter(r => !filterCode || r.code === filterCode);
    const out = ['Codes: C - connected, S - static, O - OSPF', ''];
    if (table.length === 0) {
      out.push(
        filterCode
          ? `No ${mod} routes installed in RIB.`
          : 'Routing table is empty. Configure interface IPs and run "no shutdown".'
      );
    } else {
      table.forEach(entry => {
        if (entry.code === 'C') {
          out.push(
            `C        ${entry.network}/${entry.prefix} is directly connected, ${entry.exitInterface}`
          );
        } else {
          out.push(
            `${entry.code}        ${entry.network}/${entry.prefix} [${entry.adminDistance}/${entry.metric}] via ${entry.nextHop}, ${entry.exitInterface}`
          );
        }
      });
    }
    return finalize(out);
  }

  if (subTokens[0] === 'ip' && subTokens[1] && 'protocols'.startsWith(subTokens[1]) && subTokens[1].length >= 4) {
    if (device.type !== 'router') return finalize(['% Routing protocols apply to routers.']);
    if (!device.ospf) return finalize(['No dynamic routing protocols configured.']);
    const out = [
      `Routing Protocol is "ospf ${device.ospf.processId}"`,
      `  Outgoing update filter list for all interfaces is not set`,
      `  Router ID ${device.ospf.routerId || '(auto)'}`,
      `  Number of areas in this router is ${new Set(device.ospf.networks.map(n => n.area)).size}`,
      `  Reference bandwidth unit is ${device.ospf.referenceBandwidth || 100} mbps`,
      `  Routing for Networks:`
    ];
    device.ospf.networks.forEach(n => {
      out.push(`    ${n.network} ${n.wildcard} area ${n.area}`);
    });
    if (device.ospf.passiveDefault || (device.ospf.passiveInterfaces && device.ospf.passiveInterfaces.length > 0)) {
      out.push('  Passive Interface(s):');
      if (device.ospf.passiveDefault) out.push('    default');
      (device.ospf.passiveInterfaces || []).forEach(p => out.push(`    ${p}`));
    }
    return finalize(out);
  }

  if (subTokens[0] === 'ip' && subTokens[1] === 'dhcp') {
    if (device.type !== 'router') return finalize(['% DHCP server commands apply to Layer 3 routers.']);
    const pools = device.dhcpPools || [];
    const arg = subTokens[2] || 'pool';
    if ('pool'.startsWith(arg)) {
      if (pools.length === 0) return finalize(['No DHCP pools configured.']);
      const out: string[] = [];
      pools.forEach(pool => {
        const subnetDevices = allDevices.filter(d => {
          const nic = d.interfaces[0];
          return (
            (d.type === 'pc' || d.type === 'server') &&
            nic?.ip &&
            pool.network &&
            pool.mask &&
            deps.matchesPrefix(nic.ip, pool.network, pool.mask)
          );
        });
        out.push(
          `Pool ${pool.name} :`,
          ` Utilization mark (high/low)    : 100 / 0`,
          ` Subnet size (first/next)       : 0 / 0`,
          ` Leased addresses               : ${subnetDevices.length}`,
          ` Network / Mask                 : ${pool.network || 'unconfigured'} ${pool.mask || ''}`,
          ` Default router                 : ${pool.defaultRouter || 'none'}`,
          ` DNS server                     : ${pool.dnsServer || 'none'}`,
          ''
        );
      });
      return finalize(out);
    }
    if ('binding'.startsWith(arg)) {
      const out = [
        'Bindings from all pools not associated with VRF:',
        'IP address          Client-ID/              Lease expiration        Type',
        '                    Hardware address'
      ];
      let count = 0;
      pools.forEach(pool => {
        if (!pool.network || !pool.mask) return;
        allDevices.forEach(d => {
          const nic = d.interfaces[0];
          if ((d.type === 'pc' || d.type === 'server') && nic?.ip && deps.matchesPrefix(nic.ip, pool.network!, pool.mask!)) {
            out.push(
              `${nic.ip.padEnd(20, ' ')}${nic.mac.padEnd(24, ' ')}24 hours                Automatic`
            );
            count++;
          }
        });
      });
      if (count === 0) out.push('No active DHCP bindings matched configured pool subnets.');
      return finalize(out);
    }
  }

  if (subTokens[0] === 'ip' && subTokens[1] === 'ospf') {
    if (device.type !== 'router') return finalize(['% OSPF applies to Layer 3 routers.']);
    if (!device.ospf) return finalize(['OSPF process not configured.']);
    const ospfSub = subTokens[2] || '';

    if (!ospfSub) {
      return finalize([
        ` Routing Process "ospf ${device.ospf.processId}" with ID ${device.ospf.routerId || '(auto)'}`,
        ` Reference bandwidth unit is ${device.ospf.referenceBandwidth || 100} mbps`,
        ` Supports only single TOS(TOS0) routes`,
        ` Default route origination: ${device.ospf.defaultInformationOriginate ? 'Enabled' : 'Disabled'}`,
        ` Number of areas in this router is ${new Set(device.ospf.networks.map(n => n.area)).size}`
      ]);
    }

    if ('neighbor'.startsWith(ospfSub) && ospfSub.length >= 3) {
      const out = [
        'Neighbor ID     Pri   State           Dead Time   Address         Interface'
      ];
      let count = 0;
      device.interfaces.forEach(iface => {
        if (!deps.isIfUp(device, iface) || !iface.ip) return;
        const advertised = device.ospf!.networks.some(n =>
          deps.matchesPrefix(iface.ip, n.network, deps.wildcardToMask(n.wildcard))
        );
        if (!advertised) return;
        if (device.ospf!.passiveDefault || device.ospf!.passiveInterfaces?.includes(iface.name)) return;
        const nb = findDirectlyConnectedNeighbor(device, iface, allDevices, allLinks);
        if (!nb || nb.remoteDevice.type !== 'router' || !nb.remoteDevice.ospf) return;
        const remoteIp = nb.remoteIface.ip;
        if (!remoteIp) return;
        const rid = nb.remoteDevice.ospf.routerId || remoteIp;
        const state = iface.kind === 'serial' ? 'FULL/  -' : 'FULL/DR';
        out.push(
          `${rid.padEnd(16, ' ')}1     ${state.padEnd(16, ' ')}00:00:34    ${remoteIp.padEnd(16, ' ')}${iface.shortName}`
        );
        count++;
      });
      if (count === 0) return finalize(['No converged OSPF neighbors found on up/up non-passive interfaces.']);
      return finalize(out);
    }

    if ('interface'.startsWith(ospfSub) && ospfSub.length >= 3) {
      const out = ['Interface    PID   Area            IP Address/Mask    Cost  State Nbrs'];
      device.interfaces.forEach(iface => {
        if (!iface.ip) return;
        const net = device.ospf!.networks.find(n =>
          deps.matchesPrefix(iface.ip, n.network, deps.wildcardToMask(n.wildcard))
        );
        if (!net) return;
        const up = deps.isIfUp(device, iface);
        const cost = iface.kind === 'serial' ? 64 : 1;
        out.push(
          `${iface.shortName.padEnd(13, ' ')}${device.ospf!.processId.padEnd(6, ' ')}${net.area.padEnd(16, ' ')}${(iface.ip || '').padEnd(19, ' ')}${String(cost).padEnd(6, ' ')}${up ? 'UP   ' : 'DOWN '}`
        );
      });
      return finalize(out);
    }

    if ('database'.startsWith(ospfSub) && ospfSub.length >= 3) {
      const rid = device.ospf.routerId || device.interfaces.find(i => i.ip)?.ip || '0.0.0.0';
      const out = [
        `            OSPF Router with ID (${rid}) (Process ID ${device.ospf.processId})`,
        '',
        '                Router Link States (Area 0)',
        'Link ID         ADV Router      Age         Seq#       Checksum Link count'
      ];
      out.push(`${rid.padEnd(16, ' ')}${rid.padEnd(16, ' ')}120         0x80000003 0x00A1B2 ${device.ospf.networks.length}`);
      allDevices
        .filter(d => d.id !== device.id && d.type === 'router' && d.ospf)
        .forEach((r, idx) => {
          const rId = r.ospf!.routerId || r.interfaces.find(i => i.ip)?.ip || `1.1.1.${idx + 2}`;
          out.push(
            `${rId.padEnd(16, ' ')}${rId.padEnd(16, ' ')}115         0x80000002 0x0044C1 ${r.ospf!.networks.length}`
          );
        });
      return finalize(out);
    }
  }

  if (
    (subTokens[0] && 'vlan'.startsWith(subTokens[0]) && subTokens[0].length >= 2) ||
    sub.startsWith('vlan id ')
  ) {
    if (device.type !== 'switch') {
      return finalize(['% VLAN database applies to Catalyst switches.']);
    }
    const idFilter = sub.startsWith('vlan id ') ? Number(subTokens[2]) : null;
    const list = idFilter ? device.vlans.filter(v => v.id === idFilter) : device.vlans;
    if (list.length === 0) return finalize([`VLAN id ${idFilter} not found in current VLAN database`]);
    const out = [
      'VLAN Name                             Status    Ports',
      '---- -------------------------------- --------- -------------------------------'
    ];
    list.forEach(v => {
      const ports = device.interfaces
        .filter(i => i.kind !== 'svi' && i.switchportMode !== 'trunk' && (i.accessVlan || 1) === v.id)
        .map(i => i.shortName)
        .join(', ');
      out.push(`${String(v.id).padEnd(5, ' ')}${v.name.padEnd(33, ' ')}active    ${ports}`);
    });
    return finalize(out);
  }

  if (
    sub === 'mac address-table' ||
    sub === 'mac-address-table' ||
    sub === 'mac add' ||
    sub === 'mac addr'
  ) {
    if (device.type !== 'switch') {
      return finalize(['% MAC address table applies to Catalyst switches.']);
    }
    const out = [
      '          Mac Address Table',
      '-------------------------------------------',
      'Vlan    Mac Address       Type        Ports',
      '----    -----------       --------    -----'
    ];
    let entries = 0;
    device.interfaces.forEach(iface => {
      if (iface.kind === 'svi' || !deps.isIfUp(device, iface)) return;
      const nb = findDirectlyConnectedNeighbor(device, iface, allDevices, allLinks);
      if (!nb) return;
      const vlan = iface.switchportMode === 'trunk' ? iface.trunkNativeVlan || 1 : iface.accessVlan || 1;
      out.push(
        `${String(vlan).padStart(4, ' ')}    ${nb.remoteIface.mac.padEnd(18, ' ')}DYNAMIC     ${iface.shortName}`
      );
      entries++;
    });
    if (entries === 0) {
      out.push('No dynamic MAC addresses learned on active switchports yet.');
    }
    return finalize(out);
  }

  if (subTokens[0] && ('spanning-tree'.startsWith(subTokens[0]) && subTokens[0].length >= 2) || sub === 'stp') {
    if (device.type !== 'switch') return finalize(['% Spanning Tree applies to Catalyst switches.']);
    const baseMac = device.interfaces[0]?.mac || '00:50:56:00:00:01';
    const out = [
      '',
      'VLAN0001',
      '  Spanning tree enabled protocol ieee',
      `  Root ID    Priority    32769`,
      `             Address     ${baseMac}`,
      `             This bridge is the root`,
      '',
      'Interface           Role Sts Cost      Prio.Nbr Type',
      '------------------- ---- --- --------- -------- --------------------------------'
    ];
    device.interfaces
      .filter(i => i.kind !== 'svi' && deps.isIfUp(device, i))
      .forEach(iface => {
        const typeStr = iface.portfast ? 'P2p Edge' : 'P2p';
        out.push(
          `${iface.shortName.padEnd(20, ' ')}Desg FWD 19        128.1    ${typeStr}`
        );
      });
    return finalize(out);
  }

  if (sub === 'cdp') {
    return finalize([
      device.cdpEnabled === false
        ? '% CDP is not enabled'
        : 'Global CDP information:\n        Sending CDP packets every 60 seconds\n        Sending a holdtime value of 180 seconds\n        Sending CDPv2 advertisements is enabled'
    ]);
  }

  if (
    sub === 'cdp neighbors' ||
    sub === 'cdp nei' ||
    sub === 'cdp neighbors detail' ||
    sub === 'cdp nei det' ||
    sub === 'cdp entry *'
  ) {
    if (device.cdpEnabled === false) {
      return finalize(['% CDP is not enabled']);
    }
    const isDetail = sub.endsWith('detail') || sub.endsWith('det') || sub === 'cdp entry *';
    const neighbors: Array<{ local: SimDeviceInterface; remote: SimDevice; remoteIf: SimDeviceInterface }> = [];
    device.interfaces.forEach(iface => {
      if (iface.cdpEnabled === false || !deps.isIfUp(device, iface)) return;
      const nb = findDirectlyConnectedNeighbor(device, iface, allDevices, allLinks);
      if (
        nb &&
        nb.remoteDevice.cdpEnabled !== false &&
        nb.remoteIface.cdpEnabled !== false &&
        (nb.remoteDevice.type === 'router' || nb.remoteDevice.type === 'switch')
      ) {
        neighbors.push({ local: iface, remote: nb.remoteDevice, remoteIf: nb.remoteIface });
      }
    });
    if (neighbors.length === 0) return finalize(['Total cdp entries displayed : 0']);

    if (!isDetail) {
      const out = [
        'Capability Codes: R - Router, S - Switch, I - IGMP',
        'Device ID        Local Intrfce     Holdtme    Capability  Platform  Port ID'
      ];
      neighbors.forEach(n => {
        const cap = n.remote.type === 'router' ? 'R ' : 'S I';
        const plat = n.remote.type === 'router' ? 'ISR4331' : 'WS-C2960';
        out.push(
          `${n.remote.name.padEnd(17, ' ')}${n.local.shortName.padEnd(18, ' ')}145        ${cap.padEnd(12, ' ')}${plat.padEnd(10, ' ')}${n.remoteIf.shortName}`
        );
      });
      return finalize(out);
    }

    const detailOut: string[] = [];
    neighbors.forEach(n => {
      detailOut.push(
        '-------------------------',
        `Device ID: ${n.remote.name}`,
        `Entry address(es): IP address: ${n.remoteIf.ip || 'unassigned'}`,
        `Platform: ${n.remote.model},  Capabilities: ${n.remote.type === 'router' ? 'Router' : 'Switch IGMP'}`,
        `Interface: ${n.local.name},  Port ID (outgoing port): ${n.remoteIf.name}`
      );
    });
    return finalize(detailOut);
  }

  if (sub === 'lldp neighbors' || sub === 'lldp nei') {
    const out = [
      'Capability codes: (R) Router, (B) Bridge, (S) Station Only',
      'Device ID           Local Intf     Hold-time  Capability      Port ID'
    ];
    let count = 0;
    device.interfaces.forEach(iface => {
      if (!deps.isIfUp(device, iface)) return;
      const nb = findDirectlyConnectedNeighbor(device, iface, allDevices, allLinks);
      if (!nb) return;
      const cap = nb.remoteDevice.type === 'router' ? 'R' : nb.remoteDevice.type === 'switch' ? 'B' : 'S';
      out.push(
        `${nb.remoteDevice.name.padEnd(20, ' ')}${iface.shortName.padEnd(15, ' ')}120        ${cap.padEnd(16, ' ')}${nb.remoteIface.shortName}`
      );
      count++;
    });
    return finalize(count > 0 ? out : ['Total entries displayed: 0']);
  }

  if (sub === 'arp' || sub === 'ip arp') {
    const out = [
      'Protocol  Address          Age (min)  Hardware Addr   Type   Interface'
    ];
    device.interfaces.forEach(iface => {
      if (iface.ip && deps.isIfUp(device, iface)) {
        out.push(
          `Internet  ${iface.ip.padEnd(17, ' ')}-          ${iface.mac.padEnd(16, ' ')}ARPA   ${iface.shortName}`
        );
      }
      if (deps.isIfUp(device, iface)) {
        const nb = findDirectlyConnectedNeighbor(device, iface, allDevices, allLinks);
        if (nb && nb.remoteIface.ip) {
          out.push(
            `Internet  ${nb.remoteIface.ip.padEnd(17, ' ')}2          ${nb.remoteIface.mac.padEnd(16, ' ')}ARPA   ${iface.shortName}`
          );
        }
      }
    });
    return finalize(out);
  }

  // Keep reference to resolveShowVerbMatch unused-safe or used
  void resolveShowVerbMatch;

  return null;
}
