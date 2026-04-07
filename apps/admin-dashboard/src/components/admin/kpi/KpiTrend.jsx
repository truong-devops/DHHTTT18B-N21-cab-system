function KpiTrend({ values = [] }) {
  const max = Math.max(1, ...values);
  return (
    <div className="mini-trend">
      {values.map((value, index) => (
        <div key={index} className="mini-bar" style={{ height: `${(value / max) * 100}%` }} />
      ))}
    </div>
  );
}

export default KpiTrend;
