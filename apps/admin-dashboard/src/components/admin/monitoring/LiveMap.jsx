function LiveMap({ markers = [] }) {
  return (
    <div className="card">
      <div className="card-header">
        <h3 className="card-title">Live Map Snapshot</h3>
      </div>
      <div
        style={{
          border: '1px dashed var(--border)',
          padding: 16,
          minHeight: 240,
          display: 'grid',
          gap: 8,
        }}
      >
        {markers.map((marker) => (
          <div key={marker.id} className="card">
            <strong>{marker.type}</strong> - {marker.id} ({marker.lat},{' '}
            {marker.lng})
          </div>
        ))}
        {markers.length === 0 && <div className="text-muted">No markers</div>}
      </div>
    </div>
  )
}

export default LiveMap
