import React, { useState } from 'react';
import { 
  Globe, 
  Key, 
  RefreshCw, 
  CheckCircle2, 
  ExternalLink, 
  FileCode, 
  Download, 
  ShieldCheck, 
  Copy, 
  Play, 
  Terminal,
  Layers,
  Sparkles
} from 'lucide-react';
import { useAcademy } from '../../context/AcademyContext';
import { LMSConfig } from '../../types';

export const LMSIntegrationPanel: React.FC = () => {
  const { lmsConfigs, updateLMSConfig, generateApiKeyForLMS, triggerLMSSync } = useAcademy();
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [scormExportLoading, setScormExportLoading] = useState(false);
  const [scormResult, setScormResult] = useState<any | null>(null);

  // API Tester State
  const [apiEndpoint, setApiEndpoint] = useState('/api/lms/export-scorm?courseId=CCNA-200-301');
  const [apiMethod, setApiMethod] = useState<'GET' | 'POST'>('GET');
  const [apiResponse, setApiResponse] = useState<string | null>(null);
  const [apiLoading, setApiLoading] = useState(false);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(id);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleExportScorm = async () => {
    setScormExportLoading(true);
    try {
      const res = await fetch('/api/lms/export-scorm?courseId=NET-CCNA-200-301');
      const data = await res.json();
      setScormResult(data);
    } catch (err) {
      setScormResult({
        version: 'SCORM_2004_4TH_EDITION',
        courseId: 'NET-CCNA-200-301',
        title: 'Enterprise Routing & Switching Masterclass',
        status: 'Exported Offline Mode'
      });
    } finally {
      setScormExportLoading(false);
    }
  };

  const handleTestApi = async () => {
    setApiLoading(true);
    setApiResponse(null);
    try {
      const res = await fetch(apiEndpoint);
      const data = await res.json();
      setApiResponse(JSON.stringify(data, null, 2));
    } catch (err: any) {
      setApiResponse(JSON.stringify({ error: err.message }, null, 2));
    } finally {
      setApiLoading(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-950 text-white shadow-xl border border-slate-800">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 font-mono text-xs font-semibold border border-cyan-500/30">
              LTI 1.3 & SCORM 2004 Compliant
            </span>
            <span className="text-xs text-slate-300">• External LMS Hub</span>
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight">
            External LMS API & Integration Gateway
          </h1>
          <p className="text-xs text-slate-300 mt-1 max-w-2xl">
            Seamlessly connect Canvas, Blackboard, Moodle, and Google Classroom via secure REST webhooks, OAuth 2.0 Bearer tokens, and LTI Advantage grade passback.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportScorm}
            disabled={scormExportLoading}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-md transition-all"
          >
            <Download className="w-4 h-4" />
            <span>Export SCORM / LTI Bundle</span>
          </button>
        </div>
      </div>

      {/* Connected LMS Providers */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {lmsConfigs.map((config) => (
          <div
            key={config.provider}
            className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4"
          >
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    {config.name}
                  </h3>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                      config.connected
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                        : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                    }`}
                  >
                    {config.connected ? 'Active Sync' : 'Not Configured'}
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-mono mt-0.5 truncate max-w-xs">
                  {config.endpointUrl}
                </p>
              </div>

              <button
                onClick={() => triggerLMSSync(config.provider)}
                className="p-2 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                title="Trigger Manual Synchronize"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>

            {/* Sync metrics */}
            <div className="grid grid-cols-2 gap-2 text-xs font-mono p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
              <div>
                <span className="text-[10px] text-slate-400 block uppercase">Synced Students</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">{config.syncedStudentsCount.toLocaleString()}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block uppercase">Last Sync</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">{config.lastSync}</span>
              </div>
            </div>

            {/* API Key Management */}
            <div>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="font-medium text-slate-700 dark:text-slate-300 flex items-center gap-1">
                  <Key className="w-3.5 h-3.5 text-amber-500" />
                  <span>Scoped API Token:</span>
                </span>
                <button
                  onClick={() => generateApiKeyForLMS(config.provider)}
                  className="text-blue-600 dark:text-cyan-400 text-[11px] hover:underline"
                >
                  Generate New Token
                </button>
              </div>

              <div className="flex items-center gap-1.5">
                <input
                  type="password"
                  readOnly
                  value={config.apiKey || 'None generated'}
                  className="flex-1 px-2.5 py-1.5 rounded-lg text-xs font-mono bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300"
                />
                {config.apiKey && (
                  <button
                    onClick={() => copyToClipboard(config.apiKey, config.provider)}
                    className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300"
                  >
                    {copiedKey === config.provider ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                  </button>
                )}
              </div>
            </div>

            {/* Toggles */}
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
              <label className="flex items-center gap-2 cursor-pointer text-slate-700 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={config.syncGradesAuto}
                  onChange={(e) => updateLMSConfig(config.provider, { syncGradesAuto: e.target.checked })}
                  className="rounded text-blue-600 focus:ring-blue-500"
                />
                <span>Auto Grade Passback (LTI)</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer text-slate-700 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={config.syncEnrollmentsAuto}
                  onChange={(e) => updateLMSConfig(config.provider, { syncEnrollmentsAuto: e.target.checked })}
                  className="rounded text-blue-600 focus:ring-blue-500"
                />
                <span>Auto Roster Import</span>
              </label>
            </div>
          </div>
        ))}
      </div>

      {/* SCORM Export Result preview */}
      {scormResult && (
        <div className="p-5 rounded-2xl bg-slate-900 border border-cyan-500/40 text-white font-mono text-xs space-y-3">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <span className="text-cyan-400 font-bold uppercase tracking-wider flex items-center gap-2">
              <FileCode className="w-4 h-4" />
              <span>Generated SCORM 2004 4th Edition IMS Manifest</span>
            </span>
            <button
              onClick={() => setScormResult(null)}
              className="text-slate-400 hover:text-white"
            >
              Close
            </button>
          </div>
          <pre className="p-3 bg-slate-950 rounded-xl overflow-x-auto text-[11px] text-cyan-300">
            {JSON.stringify(scormResult, null, 2)}
          </pre>
        </div>
      )}

      {/* Interactive REST API Explorer */}
      <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        <div className="flex items-center gap-2">
          <Terminal className="w-5 h-5 text-blue-500" />
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              Interactive REST API Sandbox
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Execute live API calls against Netplus endpoints to inspect response payloads.
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <select
            value={apiMethod}
            onChange={(e) => setApiMethod(e.target.value as any)}
            className="px-3 py-2 rounded-xl text-xs font-mono font-bold bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-blue-600 dark:text-cyan-400"
          >
            <option value="GET">GET</option>
            <option value="POST">POST</option>
          </select>

          <input
            type="text"
            value={apiEndpoint}
            onChange={(e) => setApiEndpoint(e.target.value)}
            className="flex-1 px-3.5 py-2 rounded-xl text-xs font-mono bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100"
          />

          <button
            onClick={handleTestApi}
            disabled={apiLoading}
            className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-sm flex items-center justify-center gap-1.5"
          >
            {apiLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
            <span>Execute Request</span>
          </button>
        </div>

        {apiResponse && (
          <div className="p-3 bg-slate-950 rounded-xl font-mono text-[11px] text-cyan-300 border border-slate-800 overflow-x-auto max-h-60">
            <pre>{apiResponse}</pre>
          </div>
        )}
      </div>
    </div>
  );
};
