import React, { useEffect } from 'react';
import { CheckCircle2, RefreshCw, WifiOff, X } from 'lucide-react';
import { useOnlineStatus, useServiceWorkerRegistration } from '../../hooks/usePWAInstall';

interface OfflineIndicatorProps {
  showOfflineToast?: boolean;
}

export const OfflineIndicator: React.FC<OfflineIndicatorProps> = ({
  showOfflineToast = true,
}) => {
  const isOnline = useOnlineStatus();
  const {
    offlineReady,
    needRefresh,
    dismissOfflineReady,
    dismissNeedRefresh,
    applyUpdate,
  } = useServiceWorkerRegistration();

  useEffect(() => {
    if (!offlineReady) return;
    const timer = window.setTimeout(() => {
      dismissOfflineReady();
    }, 5000);
    return () => window.clearTimeout(timer);
  }, [offlineReady, dismissOfflineReady]);

  if (!isOnline && showOfflineToast) {
    return (
      <div
        role="status"
        className="fixed bottom-4 left-4 z-50 flex items-center gap-2 rounded-xl bg-amber-600 px-3.5 py-2 text-xs font-semibold text-white shadow-lg border border-amber-400/40"
      >
        <WifiOff className="w-3.5 h-3.5 shrink-0" />
        <span>Offline Mode — Cached courses &amp; CLI labs remain available.</span>
      </div>
    );
  }

  if (needRefresh) {
    return (
      <div
        role="status"
        className="fixed bottom-4 right-4 z-50 flex items-center gap-3 rounded-xl bg-slate-900 dark:bg-slate-800 text-white px-4 py-2.5 text-xs shadow-xl border border-slate-700"
      >
        <RefreshCw className="w-4 h-4 text-cyan-400 shrink-0" />
        <span className="font-medium">An updated version of NetPulse Academy is ready.</span>
        <button
          type="button"
          onClick={() => applyUpdate()}
          className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 font-semibold whitespace-nowrap shrink-0 transition-colors"
        >
          Reload
        </button>
        <button
          type="button"
          onClick={dismissNeedRefresh}
          aria-label="Dismiss update notification"
          className="text-slate-400 hover:text-white p-0.5"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  if (offlineReady) {
    return (
      <div
        role="status"
        className="fixed bottom-4 right-4 z-50 flex items-center gap-2.5 rounded-xl bg-emerald-600 text-white px-3.5 py-2 text-xs font-semibold shadow-lg border border-emerald-400/40"
      >
        <CheckCircle2 className="w-4 h-4 shrink-0" />
        <span>App cached and ready for offline access.</span>
        <button
          type="button"
          onClick={dismissOfflineReady}
          aria-label="Dismiss offline ready notification"
          className="text-emerald-100 hover:text-white p-0.5"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  return null;
};
