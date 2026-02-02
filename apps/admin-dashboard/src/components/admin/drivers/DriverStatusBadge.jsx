import Badge from '../../common/Badge.jsx'

function DriverStatusBadge({ status }) {
  const variant = status === 'APPROVED' ? 'success' : 'warning'
  return <Badge variant={variant}>{status}</Badge>
}

export default DriverStatusBadge
