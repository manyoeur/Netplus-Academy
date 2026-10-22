import React, { useState, useRef, useEffect } from 'react';
import { 
  Terminal as TerminalIcon, 
  Play, 
  RotateCcw, 
  CheckCircle, 
  AlertTriangle, 
  HelpCircle, 
  Activity, 
  Cpu, 
  Server, 
  Laptop, 
  Sliders
} from 'lucide-react';
import { CourseModule, LabTopologyNode, LabTopologyLink } from '../../types';
import { useAcademy } from '../../context/AcademyContext';

interface InteractiveCliTerminalProps {
  module: CourseModule;
  courseId: string;
  onCompleted?: () => void;
}

export const InteractiveCliTerminal: React.FC<InteractiveCliTerminalProps> = ({
  module,
  courseId,
  onCompleted
}) => {
  const { completeModule } = useAcademy();
  const labData = module.lab;

  // Terminal state
  const [history, setHistory] = useState<string[]>([
    'Netplus Virtual IOS XE Software (X86_64_LINUX_IOSD-UNIVERSALK9-M), Version 17.06.01a',
    'Technical Support: https://netplus.academy/support',
    'Compiled Thu 15-Oct-26 14:18 by marcus_vance',
    '',
    '*Oct 21 21:14:02.119: %LINK-3-UPDOWN: Interface GigabitEthernet0/0/0, changed state to up',
    '*Oct 21 21:14:03.120: %LINEPROTO-5-UPDOWN: Line protocol on Interface GigabitEthernet0/0/0, changed state to up',
    '',
    'Type "help" or "?" for list of available Cisco commands.',
    '-------------------------------------------------------------------------'
  ]);
  const [currentPrompt, setCurrentPrompt] = useState('R1-HQ-Core#');
  const [inputVal, setInputVal] = useState('');
  const [commandLog, setCommandLog] = useState<string[]>([]);
  const [completedObjectives, setCompletedObjectives] = useState<string[]>([]);
  const [isFinished, setIsFinished] = useState(false);

  // Configuration state simulated inside router
  const [routerConfig, setRouterConfig] = useState({
    mode: 'privileged' as 'user' | 'privileged' | 'global' | 'interface' | 'router_ospf',
    currentInterface: '',
    ospfProcessId: '',
    routerId: '',
    ospfNetworks: [] as string[],
    interfaces: {
      'GigabitEthernet0/0/0': { ip: '10.0.0.1', mask: '255.255.255.252', status: 'up' },
      'GigabitEthernet0/0/1': { ip: '192.168.10.1', mask: '255.255.255.0', status: 'up' },
      'Loopback0': { ip: '1.1.1.1', mask: '255.255.255.255', status: 'up' }
    }
  });

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [history]);

  const handleCommandSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cmd = inputVal.trim();
    if (!cmd) return;

    const lowerCmd = cmd.toLowerCase();
    const newHistory = [...history, `${currentPrompt} ${cmd}`];
    setCommandLog(prev => [...prev, cmd]);
    setInputVal('');

    let newPrompt = currentPrompt;
    let newMode = routerConfig.mode;
    let newInter = routerConfig.currentInterface;
    let newOspfId = routerConfig.ospfProcessId;
    let newRouterId = routerConfig.routerId;
    const newNetworks = [...routerConfig.ospfNetworks];

    // Cisco CLI Parsing
    if (lowerCmd === 'clear' || lowerCmd === 'cls') {
      setHistory([]);
      return;
    } else if (lowerCmd === 'help' || lowerCmd === '?') {
      newHistory.push(
        'Available Cisco IOS commands:',
        '  configure terminal (conf t)       - Enter configuration mode',
        '  router ospf <process-id>          - Enable OSPF routing process',
        '  router-id <x.x.x.x>               - Configure OSPF router identifier',
        '  network <ip> <wildcard> area <id> - Advertise network in OSPF',
        '  interface <name>                  - Select interface to configure',
        '  show ip interface brief           - Display summary of interfaces',
        '  show ip route                     - Display IP routing table',
        '  show ip ospf neighbor             - Display OSPF adjacency state',
        '  ping <ip>                         - Test IP connectivity',
        '  exit / end                        - Return to previous mode'
      );
    } else if (lowerCmd === 'enable' || lowerCmd === 'en') {
      newMode = 'privileged';
      newPrompt = 'R1-HQ-Core#';
    } else if (lowerCmd === 'disable') {
      newMode = 'user';
      newPrompt = 'R1-HQ-Core>';
    } else if (lowerCmd === 'configure terminal' || lowerCmd === 'conf t') {
      newMode = 'global';
      newPrompt = 'R1-HQ-Core(config)#';
      newHistory.push('Enter configuration commands, one per line. End with CNTL/Z.');
    } else if (lowerCmd.startsWith('router ospf')) {
      const parts = cmd.split(' ');
      const procId = parts[2] || '1';
      newMode = 'router_ospf';
      newOspfId = procId;
      newPrompt = 'R1-HQ-Core(config-router)#';
      checkObjective('router ospf ' + procId);
    } else if (lowerCmd.startsWith('router-id')) {
      const parts = cmd.split(' ');
      const id = parts[1] || '1.1.1.1';
      newRouterId = id;
      checkObjective('router-id ' + id);
      newHistory.push('% OSPF: Reload or "clear ip ospf process" may be required for new Router ID to take effect');
    } else if (lowerCmd.startsWith('network')) {
      newNetworks.push(cmd);
      checkObjective('network');
      newHistory.push('*Oct 21 21:16:44.201: %OSPF-5-ADJCHG: Process 1, Nbr 10.0.0.2 on GigabitEthernet0/0/0 from LOADING to FULL, Loading Done');
    } else if (lowerCmd.startsWith('interface') || lowerCmd.startsWith('int ')) {
      const parts = cmd.split(' ');
      newMode = 'interface';
      newInter = parts[1] || 'Gig0/0/0';
      newPrompt = `R1-HQ-Core(config-if)#`;
    } else if (lowerCmd === 'exit') {
      if (routerConfig.mode === 'interface' || routerConfig.mode === 'router_ospf') {
        newMode = 'global';
        newPrompt = 'R1-HQ-Core(config)#';
      } else if (routerConfig.mode === 'global') {
        newMode = 'privileged';
        newPrompt = 'R1-HQ-Core#';
      }
    } else if (lowerCmd === 'end') {
      newMode = 'privileged';
      newPrompt = 'R1-HQ-Core#';
    } else if (lowerCmd === 'show ip interface brief' || lowerCmd === 'sh ip int br') {
      newHistory.push(
        'Interface                  IP-Address      OK? Method Status                Protocol',
        'GigabitEthernet0/0/0       10.0.0.1        YES manual up                    up      ',
        'GigabitEthernet0/0/1       192.168.10.1    YES manual up                    up      ',
        'Loopback0                  1.1.1.1         YES manual up                    up      '
      );
    } else if (lowerCmd === 'show ip route' || lowerCmd === 'sh ip ro') {
      newHistory.push(
        'Codes: C - connected, S - static, R - RIP, M - mobile, B - BGP',
        '       O - OSPF, IA - OSPF inter area, N1 - OSPF NSSA external type 1',
        '',
        'Gateway of last resort is not set',
        '',
        '      10.0.0.0/30 is subnetted, 1 subnets',
        'C        10.0.0.0 is directly connected, GigabitEthernet0/0/0',
        '      192.168.10.0/24 is subnetted, 1 subnets',
        'C        192.168.10.0 is directly connected, GigabitEthernet0/0/1',
        'O        192.168.20.0/24 [110/2] via 10.0.0.2, 00:01:14, GigabitEthernet0/0/0',
        'O        2.2.2.2/32 [110/2] via 10.0.0.2, 00:01:14, GigabitEthernet0/0/0'
      );
      checkObjective('show ip route');
    } else if (lowerCmd === 'show ip ospf neighbor' || lowerCmd === 'sh ip ospf nei') {
      newHistory.push(
        'Neighbor ID     Pri   State           Dead Time   Address         Interface',
        '2.2.2.2           1   FULL/  -        00:00:36    10.0.0.2        GigabitEthernet0/0/0'
      );
      checkObjective('show ip ospf neighbor');
    } else if (lowerCmd.startsWith('ping')) {
      const target = cmd.split(' ')[1] || '10.0.0.2';
      newHistory.push(
        `Type escape sequence to abort.`,
        `Sending 5, 100-byte ICMP Echos to ${target}, timeout is 2 seconds:`,
        `!!!!!`,
        `Success rate is 100 percent (5/5), round-trip min/avg/max = 1/2/4 ms`
      );
    } else {
      newHistory.push(`% Invalid input detected at '^' marker.`);
    }

    setHistory(newHistory);
    setCurrentPrompt(newPrompt);
    setRouterConfig({
      mode: newMode,
      currentInterface: newInter,
      ospfProcessId: newOspfId,
      routerId: newRouterId,
      ospfNetworks: newNetworks,
      interfaces: routerConfig.interfaces
    });
  };

  const checkObjective = (keyword: string) => {
    if (!completedObjectives.includes(keyword)) {
      const updated = [...completedObjectives, keyword];
      setCompletedObjectives(updated);

      if (updated.length >= 3 && !isFinished) {
        setIsFinished(true);
        completeModule(courseId, module.id);
        if (onCompleted) onCompleted();
      }
    }
  };

  const resetTerminal = () => {
    setHistory([
      'Netplus Virtual IOS XE Software initialized.',
      'R1-HQ-Core configuration reset to default state.',
      'Type "help" for available commands.'
    ]);
    setCurrentPrompt('R1-HQ-Core#');
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
                    <p className="text-xs font-bold leading-none">R1-HQ-Core</p>
                    <p className="text-[10px] font-mono text-slate-400">10.0.0.1/30 (Gig0/0/0)</p>
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
                R1-HQ-Core (Serial: ttyS0 / 9600-8-N-1)
              </span>
            </div>
            <span className="text-[10px] text-slate-400">VT100 Emulation</span>
          </div>

          {/* Terminal Output Area */}
          <div 
            onClick={() => inputRef.current?.focus()}
            className="flex-1 p-4 overflow-y-auto text-xs leading-relaxed space-y-1 cursor-text"
          >
            {history.map((line, idx) => (
              <div key={idx} className="whitespace-pre-wrap break-all">
                {line.startsWith('R1') ? (
                  <span className="text-yellow-400 font-bold">{line}</span>
                ) : line.startsWith('%') ? (
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
                autoFocus
                className="flex-1 bg-transparent border-none outline-none text-cyan-300 font-mono text-xs focus:ring-0 p-0"
              />
            </form>
            <div ref={bottomRef} />
          </div>

          {/* Terminal Quick Command Hints */}
          <div className="p-2.5 bg-slate-900/90 border-t border-slate-800 flex items-center gap-1.5 overflow-x-auto text-[11px]">
            <span className="text-slate-400 font-semibold px-1">Quick Run:</span>
            {[
              'configure terminal',
              'router ospf 1',
              'router-id 1.1.1.1',
              'network 10.0.0.0 0.0.0.3 area 0',
              'show ip route',
              'show ip ospf neighbor'
            ].map((shortcut, i) => (
              <button
                key={i}
                onClick={() => {
                  setInputVal(shortcut);
                  inputRef.current?.focus();
                }}
                className="whitespace-nowrap px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 hover:border-slate-500 transition-colors"
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
