import React, { useState, useRef, useEffect } from 'react';
import { 
  Bot, 
  X, 
  Send, 
  Sparkles, 
  Terminal, 
  Cpu, 
  CheckCircle2, 
  Copy, 
  AlertCircle, 
  RotateCcw,
  Zap
} from 'lucide-react';
import { useAcademy } from '../../context/AcademyContext';

interface NetGeniusTutorProps {
  isOpen: boolean;
  onClose: () => void;
  initialPrompt?: string;
}

interface Message {
  id: string;
  sender: 'user' | 'tutor';
  text: string;
  timestamp: string;
}

export const NetGeniusTutor: React.FC<NetGeniusTutorProps> = ({
  isOpen,
  onClose,
  initialPrompt
}) => {
  const { isOffline, currentUser } = useAcademy();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'm-1',
      sender: 'tutor',
      text: `Hello ${currentUser.name}! I am **NetGenius AI**, your personal CCIE-level networking mentor. 

I can help you:
• Deconstruct **OSPF, BGP, and EIGRP** routing topologies
• Solve **CIDR & VLSM** subnetting challenges in seconds
• Debug Cisco IOS syntax & interface configuration errors
• Analyze Wireshark packet captures and TCP retransmission drops

What are you currently working on?`,
      timestamp: 'Just now'
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'chat' | 'diagnose'>('chat');

  // Diagnostics Tab Form State
  const [diagScenario, setDiagScenario] = useState('OSPF Adjacency Failure');
  const [diagSymptoms, setDiagSymptoms] = useState('Router shows 2-WAY/DROTHER, no routes learned');
  const [diagLogs, setDiagLogs] = useState(`R1# show ip ospf neighbor\nNeighbor ID 10.0.0.2 Pri 1 State 2-WAY/DROTHER 00:00:34 Gig0/0`);
  const [diagResult, setDiagResult] = useState<string | null>(null);
  const [diagLoading, setDiagLoading] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (initialPrompt && isOpen) {
      handleSendPrompt(initialPrompt);
    }
  }, [initialPrompt, isOpen]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const handleSendPrompt = async (promptToSend: string) => {
    if (!promptToSend.trim() || loading) return;

    const userMsg: Message = {
      id: 'usr-' + Date.now(),
      sender: 'user',
      text: promptToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      if (isOffline) {
        // Offline local intelligence
        setTimeout(() => {
          setMessages(prev => [
            ...prev,
            {
              id: 'tut-' + Date.now(),
              sender: 'tutor',
              text: `[Offline Local Engine Active]\nRegarding: "${promptToSend}":\n\nWhen in offline mode, remember key Cisco troubleshooting steps:\n1. Verify Layer 1/2: \`show ip interface brief\`\n2. Verify Layer 3 routing: \`show ip route\`\n3. Check neighbors: \`show ip ospf neighbor\` or \`show ip bgp summary\`.\nReconnect to the network for live Gemini AI responses!`,
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            }
          ]);
          setLoading(false);
        }, 600);
        return;
      }

      const res = await fetch('/api/ai/tutor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userPrompt: promptToSend,
          context: {
            studentName: currentUser.name,
            role: currentUser.role,
            tier: currentUser.subscription.tier,
          }
        })
      });

      const data = await res.json();
      const tutorReply = data.reply || 'I processed your request, but could not formulate a response. Please rephrase.';

      setMessages(prev => [
        ...prev,
        {
          id: 'tut-' + Date.now(),
          sender: 'tutor',
          text: tutorReply,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    } catch (err: any) {
      setMessages(prev => [
        ...prev,
        {
          id: 'tut-' + Date.now(),
          sender: 'tutor',
          text: `⚠️ **Diagnostic Notice**: AI Tutor service is temporarily operating in local fallback mode. Verify your route configuration or try again in a moment.`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleRunDiagnostic = async () => {
    setDiagLoading(true);
    setDiagResult(null);

    try {
      const res = await fetch('/api/ai/diagnose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scenarioType: diagScenario,
          symptoms: diagSymptoms,
          logsOrCli: diagLogs
        })
      });
      const data = await res.json();
      setDiagResult(data.analysis || data.diagnosis || 'Analysis completed.');
    } catch (err) {
      setDiagResult(`Root Cause Analysis:
1. Interface misconfiguration or MTU mismatch.
2. Verify with 'show ip ospf interface' and match MTU with 'ip mtu 1500'.`);
    } finally {
      setDiagLoading(false);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full sm:w-[480px] bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col transition-all">
      {/* Header */}
      <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-900/60">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
            <Bot className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">NetGenius AI</h3>
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-cyan-100 text-cyan-800 dark:bg-cyan-950 dark:text-cyan-300 font-semibold">
                CCIE Tutor
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Interactive Network & CLI Diagnostic Engine
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Tabs: Chat vs Diagnostics */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 text-xs font-medium">
        <button
          onClick={() => setActiveTab('chat')}
          className={`flex-1 py-2.5 text-center flex items-center justify-center gap-1.5 transition-colors ${
            activeTab === 'chat'
              ? 'text-blue-600 dark:text-cyan-400 border-b-2 border-blue-600 dark:border-cyan-400 font-semibold'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-800'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>Interactive Chat</span>
        </button>
        <button
          onClick={() => setActiveTab('diagnose')}
          className={`flex-1 py-2.5 text-center flex items-center justify-center gap-1.5 transition-colors ${
            activeTab === 'diagnose'
              ? 'text-blue-600 dark:text-cyan-400 border-b-2 border-blue-600 dark:border-cyan-400 font-semibold'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-800'
          }`}
        >
          <Zap className="w-3.5 h-3.5" />
          <span>Network Diagnostic Lab</span>
        </button>
      </div>

      {activeTab === 'chat' ? (
        <>
          {/* Messages scroll area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
            {messages.map(m => {
              const isUser = m.sender === 'user';
              return (
                <div key={m.id} className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>
                  <div
                    className={`max-w-[90%] rounded-2xl px-4 py-3 leading-relaxed ${
                      isUser
                        ? 'bg-blue-600 text-white rounded-br-none shadow-sm'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-bl-none border border-slate-200 dark:border-slate-700/60'
                    }`}
                  >
                    <div className="whitespace-pre-wrap font-sans">
                      {m.text}
                    </div>

                    {!isUser && (
                      <div className="mt-2 pt-2 border-t border-slate-200 dark:border-slate-700/50 flex items-center justify-between text-[10px] text-slate-400">
                        <span className="font-mono">Gemini 3.8 Flash • CCIE Grounded</span>
                        <button
                          onClick={() => copyToClipboard(m.text, m.id)}
                          className="flex items-center gap-1 hover:text-slate-600 dark:hover:text-slate-200"
                        >
                          {copiedId === m.id ? (
                            <>
                              <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                              <span className="text-emerald-500 font-medium">Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" />
                              <span>Copy</span>
                            </>
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                  <span className="text-[10px] text-slate-400 px-1 mt-1 font-mono">{m.timestamp}</span>
                </div>
              );
            })}

            {loading && (
              <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-xs py-2">
                <div className="w-5 h-5 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
                <span className="font-mono">NetGenius analyzing packet flows & routing logic...</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick suggestions */}
          <div className="px-4 py-2 bg-slate-50 dark:bg-slate-900/40 border-t border-slate-200 dark:border-slate-800">
            <p className="text-[10px] font-mono text-slate-400 mb-1.5 uppercase tracking-wider font-semibold">
              Suggested Networking Topics:
            </p>
            <div className="flex gap-1.5 overflow-x-auto pb-1 text-[11px]">
              {[
                'Why OSPF stuck in 2-WAY?',
                'Subnet /28 calculation trick',
                'Explain 802.1Q trunking',
                'What is Split Horizon with Poison Reverse?'
              ].map((suggestion, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSendPrompt(suggestion)}
                  className="whitespace-nowrap px-2.5 py-1 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-blue-500 dark:hover:border-cyan-500 transition-colors"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>

          {/* Input Footer */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendPrompt(input);
            }}
            className="p-3 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center gap-2"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about Cisco CLI, OSPF, BGP, Subnetting, Wireshark..."
              className="flex-1 px-3.5 py-2 rounded-xl text-xs bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="submit"
              disabled={!input.trim() || loading}
              className="p-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white transition-all shadow-sm"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </>
      ) : (
        /* Diagnostics Tab */
        <div className="flex-1 overflow-y-auto p-4 space-y-3.5 text-xs">
          <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 text-blue-900 dark:text-blue-300">
            <div className="flex items-center gap-1.5 font-bold mb-1">
              <Zap className="w-4 h-4 text-blue-500" />
              <span>Automated Network Forensics</span>
            </div>
            <p className="text-[11px] leading-relaxed">
              Feed in your Cisco CLI outputs, routing table extracts, or symptoms to trigger automated root-cause analysis and remediation scripts.
            </p>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Failure Category
            </label>
            <select
              value={diagScenario}
              onChange={(e) => setDiagScenario(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-xs"
            >
              <option value="OSPF Adjacency Failure">OSPF Adjacency Failure</option>
              <option value="VLAN Trunking / Native VLAN Mismatch">VLAN Trunking / Native VLAN Mismatch</option>
              <option value="Subnet Mask Miscalculation">Subnet Mask Miscalculation</option>
              <option value="Extended ACL Traffic Drop">Extended ACL Traffic Drop</option>
              <option value="BGP Idle / Connect Timeout">BGP Idle / Connect Timeout</option>
              <option value="Wireshark TCP Retransmissions">Wireshark TCP Retransmissions</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Reported Symptoms
            </label>
            <input
              type="text"
              value={diagSymptoms}
              onChange={(e) => setDiagSymptoms(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-xs"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
              CLI / Syslog / Packet Hex
            </label>
            <textarea
              rows={4}
              value={diagLogs}
              onChange={(e) => setDiagLogs(e.target.value)}
              className="w-full p-2.5 rounded-lg bg-slate-950 font-mono text-[11px] text-cyan-400 border border-slate-800 focus:outline-none"
            />
          </div>

          <button
            onClick={handleRunDiagnostic}
            disabled={diagLoading}
            className="w-full py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white font-semibold text-xs shadow-md transition-all flex items-center justify-center gap-2"
          >
            {diagLoading ? (
              <>
                <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                <span>Running Deep Diagnostic...</span>
              </>
            ) : (
              <>
                <Zap className="w-4 h-4" />
                <span>Analyze Root Cause with NetGenius</span>
              </>
            )}
          </button>

          {diagResult && (
            <div className="mt-4 p-3.5 rounded-xl bg-slate-900 border border-cyan-500/30 text-slate-100 font-sans">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-2">
                <span className="text-[11px] font-mono text-cyan-400 font-bold uppercase tracking-wider">
                  Diagnostic Report
                </span>
                <button
                  onClick={() => copyToClipboard(diagResult, 'diag')}
                  className="text-[10px] text-slate-400 hover:text-white flex items-center gap-1"
                >
                  <Copy className="w-3 h-3" />
                  <span>Copy</span>
                </button>
              </div>
              <div className="text-xs whitespace-pre-wrap leading-relaxed">
                {diagResult}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
