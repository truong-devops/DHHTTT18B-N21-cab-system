import { createContext, useCallback, useMemo, useState } from 'react';
import Toast from '../components/common/Toast.jsx';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);

  const push = useCallback((message, variant = 'info') => {
    const id = crypto.randomUUID ? crypto.randomUUID() : Date.now().toString();
    setItems((prev) => [...prev, { id, message, variant }]);
    setTimeout(() => {
      setItems((prev) => prev.filter((item) => item.id !== id));
    }, 3000);
  }, []);

  const value = useMemo(() => ({ push }), [push]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-stack">
        {items.map((item) => (
          <Toast key={item.id} message={item.message} variant={item.variant} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export { ToastContext };
