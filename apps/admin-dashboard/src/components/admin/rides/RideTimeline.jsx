function RideTimeline({ steps = [] }) {
  return (
    <div className="card">
      <div className="section-title">Tiến trình</div>
      <ul style={{ paddingLeft: 16, margin: 0 }}>
        {steps.map((step) => (
          <li key={step.label} style={{ marginBottom: 6 }}>
            <strong>{step.label}</strong> - {step.time}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default RideTimeline;
