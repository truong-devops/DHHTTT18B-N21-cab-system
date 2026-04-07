function Input({ label, helper, className = '', ...props }) {
  return (
    <div>
      {label && <label className="input-label">{label}</label>}
      <input className={`input ${className}`.trim()} {...props} />
      {helper && <div className="input-helper">{helper}</div>}
    </div>
  );
}

export default Input;
