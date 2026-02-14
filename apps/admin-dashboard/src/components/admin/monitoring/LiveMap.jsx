import { labelFrom, markerTypeLabels } from '../../../utils/labels.js'

function LiveMap({ markers = [] }) {
  return (
    <div className="card">
      <div className="card-header">
        <h3 className="card-title">Ảnh chụp bản đồ trực tuyến</h3>
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
            <strong>{labelFrom(markerTypeLabels, marker.type)}</strong> - {marker.id} (
            {marker.lat},{' '}
            {marker.lng})
          </div>
        ))}
        {markers.length === 0 && <div className="text-muted">Không có điểm</div>}
      </div>
    </div>
  )
}

export default LiveMap
