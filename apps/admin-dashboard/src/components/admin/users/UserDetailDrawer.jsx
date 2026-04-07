import Drawer from '../../common/Drawer.jsx';
import Button from '../../common/Button.jsx';
import Badge from '../../common/Badge.jsx';
import { labelFrom, userStatusLabels } from '../../../utils/labels.js';

function UserDetailDrawer({ user, onClose, onToggleStatus }) {
  if (!user) return null;

  return (
    <Drawer title="Chi tiết người dùng" onClose={onClose}>
      <div className="card" style={{ marginBottom: 12 }}>
        <div className="section-title">Hồ sơ</div>
        <div>{user.email}</div>
        <div>{user.fullName}</div>
        <div>{user.phone}</div>
        <Badge variant={user.status === 'ACTIVE' ? 'success' : 'danger'}>{labelFrom(userStatusLabels, user.status)}</Badge>
      </div>
      <div style={{ display: 'flex', gap: 10 }}>
        <Button variant="outline" onClick={() => onToggleStatus?.(user)}>
          Đổi trạng thái
        </Button>
        <Button variant="ghost" onClick={onClose}>
          Đóng
        </Button>
      </div>
    </Drawer>
  );
}

export default UserDetailDrawer;
