import { useEffect, useRef, useState } from 'react'

export default function useWebSocket(url, enabled = false) {
  const [message, setMessage] = useState(null)
  const [connected, setConnected] = useState(false)
  const wsRef = useRef(null)

  useEffect(() => {
    if (!enabled || !url) return
    const ws = new WebSocket(url)
    wsRef.current = ws
    ws.onopen = () => setConnected(true)
    ws.onclose = () => setConnected(false)
    ws.onmessage = (event) => setMessage(event.data)
    return () => ws.close()
  }, [url, enabled])

  const send = (payload) => {
    if (wsRef.current && connected) wsRef.current.send(payload)
  }

  return { connected, message, send }
}
