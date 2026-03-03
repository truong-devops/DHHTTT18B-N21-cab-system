export type ApiLog = {
  id: string;
  ts: number;
  method: string;
  url: string;
  status?: number;
  durationMs?: number;
  requestId?: string;
  error?: string;
};

const MAX_LOGS = 50;
let logs: ApiLog[] = [];
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((listener) => listener());
}

export function addLog(entry: ApiLog) {
  logs = [entry, ...logs].slice(0, MAX_LOGS);
  notify();
}

export function getLogs() {
  return logs;
}

export function subscribeLogs(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
