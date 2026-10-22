import React, { useState, useMemo } from 'react';
import { 
  Calculator, 
  Binary, 
  Layers, 
  CheckCircle2, 
  Sparkles, 
  RefreshCw, 
  Copy, 
  HelpCircle,
  Clock,
  Award
} from 'lucide-react';

export const SubnettingCalculator: React.FC = () => {
  const [ipInput, setIpInput] = useState('192.168.10.0');
  const [cidrInput, setCidrInput] = useState<number>(27);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // VLSM Planner State
  const [vlsmBaseNetwork, setVlsmBaseNetwork] = useState('172.16.0.0/20');
  const [departments, setDepartments] = useState([
    { name: 'Engineering Core', hostsRequired: 120 },
    { name: 'Sales & Marketing', hostsRequired: 60 },
    { name: 'IT Infrastructure', hostsRequired: 25 },
    { name: 'Guest Wi-Fi', hostsRequired: 25 },
    { name: 'Point-to-Point WAN', hostsRequired: 2 }
  ]);

  // Speed Drill State
  const [drillScore, setDrillScore] = useState(0);
  const [drillQuestion, setDrillQuestion] = useState({
    ip: '192.168.4.0/28',
    question: 'What is the broadcast address for 192.168.4.0/28?',
    options: ['192.168.4.15', '192.168.4.16', '192.168.4.31', '192.168.4.255'],
    correct: '192.168.4.15'
  });
  const [drillAnswered, setDrillAnswered] = useState<string | null>(null);
  const [drillFeedback, setDrillFeedback] = useState<string | null>(null);

  // Subnet calculations
  const subnetInfo = useMemo(() => {
    try {
      const parts = ipInput.split('.').map(p => parseInt(p, 10));
      if (parts.length !== 4 || parts.some(p => isNaN(p) || p < 0 || p > 255)) {
        return null;
      }

      const totalHostBits = 32 - cidrInput;
      const totalAddresses = Math.pow(2, totalHostBits);
      const usableHosts = cidrInput >= 31 ? (cidrInput === 31 ? 2 : 1) : totalAddresses - 2;

      // Mask integer
      let maskInt = 0;
      for (let i = 0; i < cidrInput; i++) {
        maskInt |= (1 << (31 - i));
      }
      maskInt = maskInt >>> 0;

      // Wildcard
      const wildcardInt = ~maskInt >>> 0;

      // IP int
      const ipInt = ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;

      // Network int
      const networkInt = (ipInt & maskInt) >>> 0;
      const broadcastInt = (networkInt | wildcardInt) >>> 0;

      const intToIp = (num: number) => [
        (num >>> 24) & 255,
        (num >>> 16) & 255,
        (num >>> 8) & 255,
        num & 255
      ].join('.');

      const intToBinary = (num: number) => [
        ((num >>> 24) & 255).toString(2).padStart(8, '0'),
        ((num >>> 16) & 255).toString(2).padStart(8, '0'),
        ((num >>> 8) & 255).toString(2).padStart(8, '0'),
        (num & 255).toString(2).padStart(8, '0')
      ].join('.');

      const maskStr = intToIp(maskInt);
      const wildcardStr = intToIp(wildcardInt);
      const networkStr = intToIp(networkInt);
      const broadcastStr = intToIp(broadcastInt);

      const firstHost = cidrInput >= 31 ? networkStr : intToIp(networkInt + 1);
      const lastHost = cidrInput >= 31 ? broadcastStr : intToIp(broadcastInt - 1);

      return {
        maskStr,
        wildcardStr,
        networkStr,
        broadcastStr,
        firstHost,
        lastHost,
        usableHosts,
        totalAddresses,
        binaryMask: intToBinary(maskInt),
        binaryIp: intToBinary(ipInt)
      };
    } catch {
      return null;
    }
  }, [ipInput, cidrInput]);

  const copyVal = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleNextDrill = () => {
    const drills = [
      {
        ip: '10.0.0.0/29',
        question: 'How many usable host IP addresses are in a /29 subnet?',
        options: ['4', '6', '8', '14'],
        correct: '6'
      },
      {
        ip: '172.16.50.0/26',
        question: 'What is the dotted-decimal subnet mask for /26?',
        options: ['255.255.255.128', '255.255.255.192', '255.255.255.224', '255.255.255.240'],
        correct: '255.255.255.192'
      },
      {
        ip: '192.168.1.64/26',
        question: 'What is the Cisco OSPF wildcard mask for a /26 network?',
        options: ['0.0.0.63', '0.0.0.31', '0.0.0.127', '0.0.0.255'],
        correct: '0.0.0.63'
      },
      {
        ip: '10.1.1.0/30',
        question: 'What is the broadcast address for 10.1.1.0/30?',
        options: ['10.1.1.1', '10.1.1.2', '10.1.1.3', '10.1.1.4'],
        correct: '10.1.1.3'
      }
    ];

    const pick = drills[Math.floor(Math.random() * drills.length)];
    setDrillQuestion(pick);
    setDrillAnswered(null);
    setDrillFeedback(null);
  };

  const submitDrillAnswer = (option: string) => {
    setDrillAnswered(option);
    if (option === drillQuestion.correct) {
      setDrillScore(prev => prev + 10);
      setDrillFeedback('Correct! Outstanding mental math speed.');
    } else {
      setDrillFeedback(`Incorrect. The correct answer is ${drillQuestion.correct}.`);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-2xl bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white shadow-xl">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 font-mono text-xs font-semibold border border-cyan-500/30">
              Offline-Ready Utility
            </span>
            <span className="text-xs text-slate-300">• CCNA & CCNP Certified</span>
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight">
            Subnetting & VLSM Architecture Workbench
          </h1>
          <p className="text-xs text-slate-300 mt-1 max-w-2xl">
            Real-time IPv4 CIDR breakdown, Cisco wildcard mask derivation, binary octet analysis, and automated Variable Length Subnet Masking (VLSM).
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="px-3.5 py-2 rounded-xl bg-white/10 backdrop-blur-md border border-white/10 text-center">
            <span className="text-[10px] text-slate-300 uppercase font-mono block">Speed Drill Score</span>
            <span className="text-lg font-bold font-mono text-cyan-300">{drillScore} pts</span>
          </div>
        </div>
      </div>

      {/* Main CIDR Calculator */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Input Parameters */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <Calculator className="w-4 h-4 text-blue-500" />
            <span>IP & CIDR Parameters</span>
          </h2>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              IPv4 Address:
            </label>
            <input
              type="text"
              value={ipInput}
              onChange={(e) => setIpInput(e.target.value)}
              placeholder="e.g. 192.168.10.0"
              className="w-full px-3 py-2 rounded-xl text-sm font-mono bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <div className="flex items-center justify-between text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              <span>Prefix Length (CIDR):</span>
              <span className="font-mono font-bold text-blue-600 dark:text-cyan-400">/{cidrInput}</span>
            </div>
            <input
              type="range"
              min="8"
              max="32"
              value={cidrInput}
              onChange={(e) => setCidrInput(parseInt(e.target.value, 10))}
              className="w-full accent-blue-600"
            />
            <div className="flex justify-between text-[10px] font-mono text-slate-400 mt-1">
              <span>/8 (Class A)</span>
              <span>/16 (Class B)</span>
              <span>/24 (Class C)</span>
              <span>/30 (WAN)</span>
            </div>
          </div>

          <div className="pt-2">
            <span className="text-xs font-medium text-slate-700 dark:text-slate-300 block mb-2">
              Common Presets:
            </span>
            <div className="grid grid-cols-4 gap-1.5 text-xs font-mono">
              {[24, 26, 28, 30].map(c => (
                <button
                  key={c}
                  onClick={() => setCidrInput(c)}
                  className={`py-1.5 rounded-lg border text-center transition-all ${
                    cidrInput === c
                      ? 'bg-blue-600 text-white font-bold border-blue-600'
                      : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                  }`}
                >
                  /{c}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Calculated Results Cards */}
        {subnetInfo && (
          <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
            
            <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Network ID</span>
                <button
                  onClick={() => copyVal(subnetInfo.networkStr, 'net')}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-white"
                >
                  {copiedKey === 'net' ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
              <p className="text-lg font-mono font-bold text-slate-900 dark:text-slate-100 mt-1">
                {subnetInfo.networkStr}
              </p>
              <p className="text-[10px] text-slate-400 font-mono mt-0.5">/{cidrInput} Subnet Boundary</p>
            </div>

            <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Broadcast Address</span>
                <button
                  onClick={() => copyVal(subnetInfo.broadcastStr, 'bcast')}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-white"
                >
                  {copiedKey === 'bcast' ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
              <p className="text-lg font-mono font-bold text-slate-900 dark:text-slate-100 mt-1">
                {subnetInfo.broadcastStr}
              </p>
              <p className="text-[10px] text-slate-400 font-mono mt-0.5">All host bits set to 1</p>
            </div>

            <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Subnet Mask</span>
                <button
                  onClick={() => copyVal(subnetInfo.maskStr, 'mask')}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-white"
                >
                  {copiedKey === 'mask' ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
              <p className="text-lg font-mono font-bold text-blue-600 dark:text-cyan-400 mt-1">
                {subnetInfo.maskStr}
              </p>
              <p className="text-[10px] text-slate-400 font-mono mt-0.5">Decimal Format</p>
            </div>

            <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Cisco Wildcard Mask</span>
                <button
                  onClick={() => copyVal(subnetInfo.wildcardStr, 'wild')}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-white"
                >
                  {copiedKey === 'wild' ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
              <p className="text-lg font-mono font-bold text-amber-600 dark:text-amber-400 mt-1">
                {subnetInfo.wildcardStr}
              </p>
              <p className="text-[10px] text-slate-400 font-mono mt-0.5">For OSPF network & ACLs</p>
            </div>

            <div className="sm:col-span-2 p-4 rounded-xl bg-slate-900 text-white border border-slate-800">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-2 mb-2">
                <span className="text-xs font-mono text-cyan-400 font-semibold">
                  Usable Host Range:
                </span>
                <span className="text-xs font-mono font-bold text-emerald-400">
                  {subnetInfo.usableHosts.toLocaleString()} Usable Hosts (Total {subnetInfo.totalAddresses.toLocaleString()})
                </span>
              </div>
              <div className="flex items-center gap-2 font-mono text-sm">
                <span className="text-slate-300">{subnetInfo.firstHost}</span>
                <span className="text-slate-500">➔</span>
                <span className="text-slate-300">{subnetInfo.lastHost}</span>
              </div>
              <div className="mt-3 pt-2 border-t border-slate-800/80 text-[11px] font-mono text-slate-400 flex items-center justify-between">
                <span>Binary Mask:</span>
                <span className="text-cyan-300/80">{subnetInfo.binaryMask}</span>
              </div>
            </div>

          </div>
        )}
      </div>

      {/* Speed Drill Section */}
      <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Award className="w-5 h-5 text-amber-500" />
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
              CCNA Subnetting Speed Drill
            </h3>
          </div>
          <button
            onClick={handleNextDrill}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Next Question</span>
          </button>
        </div>

        <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60">
          <p className="text-xs font-medium text-slate-900 dark:text-slate-100 mb-3">
            {drillQuestion.question}
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {drillQuestion.options.map((opt, i) => {
              const isSelected = drillAnswered === opt;
              const isCorrect = opt === drillQuestion.correct;
              let btnClass = 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-blue-500';

              if (drillAnswered) {
                if (isCorrect) {
                  btnClass = 'bg-emerald-50 dark:bg-emerald-950 border-emerald-500 text-emerald-800 dark:text-emerald-300 font-bold';
                } else if (isSelected) {
                  btnClass = 'bg-red-50 dark:bg-red-950 border-red-500 text-red-800 dark:text-red-300';
                }
              }

              return (
                <button
                  key={i}
                  disabled={drillAnswered !== null}
                  onClick={() => submitDrillAnswer(opt)}
                  className={`p-2.5 rounded-lg border text-left text-xs font-mono transition-all ${btnClass}`}
                >
                  {opt}
                </button>
              );
            })}
          </div>

          {drillFeedback && (
            <p className={`mt-3 text-xs font-semibold ${drillFeedback.includes('Correct') ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
              {drillFeedback}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
