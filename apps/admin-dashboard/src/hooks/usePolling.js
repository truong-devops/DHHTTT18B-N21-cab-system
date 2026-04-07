import { useEffect, useRef } from 'react';

export function usePolling(callback, interval = 3000) {
  const saved = useRef(callback);

  useEffect(() => {
    saved.current = callback;
  }, [callback]);

  useEffect(() => {
    if (!interval) return undefined;
    const id = setInterval(() => saved.current?.(), interval);
    return () => clearInterval(id);
  }, [interval]);
}
