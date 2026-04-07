import Drawer from '../../common/Drawer.jsx';
import Badge from '../../common/Badge.jsx';
import { labelFrom, onlineStatusLabels, vehicleTypeLabels } from '../../../utils/labels.js';

function DriverDetailDrawer({ driver, onClose }) {
  if (!driver) return null;

  return (
    <Drawer title="Chi tiết tài xế" onClose={onClose}>
      <div className="card" style={{ marginBottom: 12 }}>
        <div className="section-title">Hồ sơ</div>
        <div>{driver.fullName}</div>
        <div>{labelFrom(vehicleTypeLabels, driver.vehicleType)}</div>
        <div>{driver.plateNumber}</div>
      </div>
      <div className="card">
        <div className="section-title">Trạng thái</div>
        <Badge variant={driver.onlineStatus === 'ONLINE' ? 'success' : 'warning'}>{labelFrom(onlineStatusLabels, driver.onlineStatus)}</Badge>
      </div>
    </Drawer>
  );
}

export default DriverDetailDrawer;
