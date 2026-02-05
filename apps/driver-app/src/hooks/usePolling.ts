import { useEffect, useRef } from 'react'

export const usePolling = (fn: () => void | Promise<void>, intervalMs: number, enabled = true) => {
  const saved = useRef(fn)

  useEffect(() => {
    saved.current = fn
  }, [fn])

  useEffect(() => {
    if (!enabled) return undefined
    const id = setInterval(() => {
      Promise.resolve(saved.current()).catch(() => {
        // errors are logged in api.ts; avoid unhandled promise rejection
      })
    }, intervalMs)
    return () => clearInterval(id)
  }, [intervalMs, enabled])
}
