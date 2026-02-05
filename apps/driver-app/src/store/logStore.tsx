import React, { createContext, useContext, useEffect, useMemo, useState } from 'react'

export type ApiLogEntry = {
  id: string
  time: string
  method: string
  url: string
  status?: number
  durationMs?: number
  requestId?: string
  correlationId?: string
  ok: boolean
  error?: {
    status?: number
    code?: string
    message?: string
    body?: unknown
  }
}

type LogContextValue = {
  logs: ApiLogEntry[]
  clear: () => void
}

const LogContext = createContext<LogContextValue | undefined>(undefined)

let logCache: ApiLogEntry[] = []
const listeners = new Set<(logs: ApiLogEntry[]) => void>()

const emit = () => {
  listeners.forEach((fn) => fn(logCache))
}

export const logService = {
  add(entry: ApiLogEntry) {
    logCache = [entry, ...logCache].slice(0, 200)
    emit()
  },
  clear() {
    logCache = []
    emit()
  },
  subscribe(fn: (logs: ApiLogEntry[]) => void) {
    listeners.add(fn)
    fn(logCache)
    return () => listeners.delete(fn)
  }
}

export const LogProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [logs, setLogs] = useState<ApiLogEntry[]>(logCache)

  useEffect(() => logService.subscribe(setLogs), [])

  const value = useMemo(() => ({ logs, clear: logService.clear }), [logs])

  return <LogContext.Provider value={value}>{children}</LogContext.Provider>
}

export const useLogs = () => {
  const ctx = useContext(LogContext)
  if (!ctx) throw new Error('useLogs must be used within LogProvider')
  return ctx
}
