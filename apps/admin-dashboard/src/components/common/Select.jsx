function Select({ label, helper, className = '', children, ...props }) {
  return (
    <div>
      {label && <label className="input-label">{label}</label>}
      <select className={`select ${className}`.trim()} {...props}>
        {children}
      </select>
      {helper && <div className="input-helper">{helper}</div>}
    </div>
  );
}

export default Select;
