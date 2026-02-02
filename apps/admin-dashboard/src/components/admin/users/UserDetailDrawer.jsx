import Drawer from '../../common/Drawer.jsx'
import Button from '../../common/Button.jsx'
import Badge from '../../common/Badge.jsx'

function UserDetailDrawer({ user, onClose, onToggleStatus }) {
  if (!user) return null

  return (
    <Drawer title="User Detail" onClose={onClose}>
      <div className="card" style={{ marginBottom: 12 }}>
        <div className="section-title">Profile</div>
        <div>{user.email}</div>
        <div>{user.fullName}</div>
        <div>{user.phone}</div>
        <Badge variant={user.status === 'ACTIVE' ? 'success' : 'danger'}>
          {user.status}
        </Badge>
      </div>
      <div style={{ display: 'flex', gap: 10 }}>
        <Button variant="outline" onClick={() => onToggleStatus?.(user)}>
          Toggle Status
        </Button>
        <Button variant="ghost" onClick={onClose}>
          Close
        </Button>
      </div>
    </Drawer>
  )
}

export default UserDetailDrawer
