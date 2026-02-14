function Badge({ variant = 'info', children }) {
  return <span className={`badge ${variant}`}>{children}</span>
}

export default Badge
