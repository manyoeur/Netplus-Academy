export interface LabReplayStep {
  id: string;
  elapsedMs: number;
  deviceId: string;
  deviceName: string;
  prompt: string;
  command: string;
  hadError?: boolean;
  outputPreview?: string;
}

export interface LabReplaySnapshot<TState = unknown> {
  kind: 'embedded-cli' | 'topology-sim';
  state: TState;
}

export interface LabReplaySession<TState = unknown> {
  id: string;
  userId: string;
  scopeKey: string;
  title: string;
  createdAt: string;
  durationMs: number;
  steps: LabReplayStep[];
  initialSnapshot?: LabReplaySnapshot<TState>;
}

const STORAGE_PREFIX = 'netplus_lab_replays_v1';
const MAX_SESSIONS_PER_USER = 25;

function getStorageKey(userId?: string | null): string {
  const safeUser = (userId || 'guest').replace(/[^a-zA-Z0-9_-]/g, '_');
  return `${STORAGE_PREFIX}:${safeUser}`;
}

export function deepCloneReplayData<T>(value: T): T {
  if (typeof structuredClone === 'function') {
    try {
      return structuredClone(value);
    } catch {
      // Fallback to JSON clone
    }
  }
  return JSON.parse(JSON.stringify(value)) as T;
}

export function formatReplayTime(ms: number): string {
  const clamped = Math.max(0, Math.floor(ms / 1000));
  const mins = Math.floor(clamped / 60);
  const secs = clamped % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function isCiscoCliErrorLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return false;
  if (/^\^$/.test(trimmed)) return true;
  if (!trimmed.startsWith('%')) return false;
  // Exclude informational Cisco syslog notifications
  if (/^%(SYS|LINK|LINEPROTO|OSPF-\d+-ADJCHG|DUAL|STP|PORT_SECURITY)/i.test(trimmed)) {
    return false;
  }
  return true;
}

export function getStepPlaybackDelayMs(
  steps: LabReplayStep[],
  nextStepIndex: number,
  speed: number
): number {
  if (nextStepIndex < 0 || nextStepIndex >= steps.length) return 650;
  const prevElapsed = nextStepIndex === 0 ? 0 : steps[nextStepIndex - 1].elapsedMs;
  const nextElapsed = steps[nextStepIndex].elapsedMs;
  const rawDelta = Math.max(300, nextElapsed - prevElapsed);
  // Clamp long idle pauses so playback stays brisk and reviewable
  const normalized = Math.min(1600, Math.max(320, rawDelta));
  return Math.max(120, Math.round(normalized / Math.max(0.25, speed)));
}

export function loadLabReplays<TState = unknown>(
  userId?: string | null,
  scopeKey?: string
): LabReplaySession<TState>[] {
  try {
    const raw = window.localStorage.getItem(getStorageKey(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const sessions = parsed.filter(
      (item): item is LabReplaySession<TState> =>
        Boolean(item && typeof item.id === 'string' && Array.isArray(item.steps))
    );
    const filtered = scopeKey ? sessions.filter(s => s.scopeKey === scopeKey) : sessions;
    return filtered.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  } catch {
    return [];
  }
}

export function saveLabReplay<TState = unknown>(
  session: LabReplaySession<TState>
): LabReplaySession<TState>[] {
  const key = getStorageKey(session.userId);
  const existingAll = loadLabReplays<TState>(session.userId);
  const deduped = [session, ...existingAll.filter(s => s.id !== session.id)].slice(
    0,
    MAX_SESSIONS_PER_USER
  );

  const tryPersist = (list: LabReplaySession<TState>[]) => {
    window.localStorage.setItem(key, JSON.stringify(list));
  };

  try {
    tryPersist(deduped);
  } catch {
    // Trim older snapshots first if storage quota is tight
    const trimmed = deduped.map((item, idx) =>
      idx > 4 ? { ...item, initialSnapshot: undefined } : item
    );
    try {
      tryPersist(trimmed);
    } catch {
      try {
        tryPersist(trimmed.slice(0, 10));
      } catch {
        // Ignore storage quota failure gracefully
      }
    }
  }

  return session.scopeKey
    ? deduped.filter(s => s.scopeKey === session.scopeKey)
    : deduped;
}

export function deleteLabReplay(
  userId: string | null | undefined,
  sessionId: string,
  scopeKey?: string
): LabReplaySession[] {
  const key = getStorageKey(userId);
  const existing = loadLabReplays(userId);
  const next = existing.filter(s => s.id !== sessionId);
  try {
    window.localStorage.setItem(key, JSON.stringify(next));
  } catch {
    // Ignore
  }
  return scopeKey ? next.filter(s => s.scopeKey === scopeKey) : next;
}

export function exportReplayAsScript(session: LabReplaySession): string {
  const header = [
    `# Netplus Academy — Lab Replay Transcript`,
    `# Title: ${session.title}`,
    `# Recorded: ${new Date(session.createdAt).toLocaleString()}`,
    `# Duration: ${formatReplayTime(session.durationMs)} · Steps: ${session.steps.length}`,
    `# ------------------------------------------------------------------`,
    ''
  ];

  const lines = session.steps.map((step, index) => {
    const timeTag = `[${formatReplayTime(step.elapsedMs)}]`;
    const errTag = step.hadError ? '  ! [CLI ERROR DETECTED]' : '';
    const line = `${String(index + 1).padStart(2, '0')}. ${timeTag} (${step.deviceName}) ${step.prompt} ${step.command}${errTag}`;
    if (step.outputPreview) {
      return `${line}\n    -> ${step.outputPreview}`;
    }
    return line;
  });

  return [...header, ...lines, ''].join('\n');
}

export function triggerReplayScriptDownload(session: LabReplaySession): void {
  const content = exportReplayAsScript(session);
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const slug = session.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${slug || 'lab-replay'}.txt`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
