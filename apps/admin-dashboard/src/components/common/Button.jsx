function Button({ variant = 'primary', className = '', ...props }) {
  const classes = `btn btn-${variant} ${className}`.trim()
  return <button className={classes} {...props} />
}

export default Button
