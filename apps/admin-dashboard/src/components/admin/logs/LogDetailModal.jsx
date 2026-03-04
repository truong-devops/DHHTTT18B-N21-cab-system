import Badge from '../../common/Badge.jsx'
import Modal from '../../common/Modal.jsx'
import { labelFrom, logLevelLabels } from '../../../utils/labels.js'

function toBadgeVariant(level) {
  if (level === 'ERROR') return 'danger'
  if (level === 'WARN') return 'warning'
  return 'info'
}

function formatTime(value) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString()
}

function LogDetailModal({ log, onClose }) {
  if (!log) return null

  return (
    <Modal title="Log detail" onClose={onClose}>
      <div className="card" style={{ marginTop: 12 }}>
        <div style={{ marginBottom: 8 }}>
          <strong>ID:</strong> {log.id || '-'}
        </div>
        <div style={{ marginBottom: 8 }}>
          <strong>Time:</strong> {formatTime(log.timestamp)}
        </div>
        <div style={{ marginBottom: 8 }}>
          <strong>Service:</strong> {log.service || '-'}
        </div>
        <div style={{ marginBottom: 8 }}>
          <strong>Level:</strong>{' '}
          <Badge variant={toBadgeVariant(log.level)}>
            {labelFrom(logLevelLabels, log.level)}
          </Badge>
        </div>
        <div style={{ marginBottom: 8 }}>
          <strong>Request ID:</strong> {log.requestId || '-'}
        </div>
        <div>
          <strong>Message:</strong>
          <div style={{ marginTop: 6 }}>{log.message || '-'}</div>
        </div>
      </div>
    </Modal>
  )
}

export default LogDetailModal
