import { useContext } from 'react';
import { ToastContext } from '../context/ToastContext.jsx';

export function useToast() {
  return useContext(ToastContext);
}
