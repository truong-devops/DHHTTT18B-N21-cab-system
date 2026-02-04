import { useEffect, useRef } from 'react'

export default function usePolling(fn, intervalMs, deps = []) {
  const saved = useRef(fn)
  useEffect(() => {
    saved.current = fn
  }, [fn])

  useEffect(() => {
    if (!intervalMs) return
    const id = setInterval(() => saved.current(), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs, ...deps])
}
