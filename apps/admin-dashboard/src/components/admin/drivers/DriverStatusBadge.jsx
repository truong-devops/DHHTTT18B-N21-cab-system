import Badge from '../../common/Badge.jsx';
import { driverStatusLabels, labelFrom } from '../../../utils/labels.js';

function DriverStatusBadge({ status }) {
  const variant = status === 'APPROVED' ? 'success' : 'warning';
  return <Badge variant={variant}>{labelFrom(driverStatusLabels, status)}</Badge>;
}

export default DriverStatusBadge;
