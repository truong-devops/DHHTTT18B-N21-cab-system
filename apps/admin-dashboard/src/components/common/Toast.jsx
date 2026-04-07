function Toast({ message, variant = 'info' }) {
  return <div className={`toast badge ${variant}`}>{message}</div>;
}

export default Toast;
