import Drawer from '../../common/Drawer.jsx'
import Badge from '../../common/Badge.jsx'

function DriverDetailDrawer({ driver, onClose }) {
  if (!driver) return null

  return (
    <Drawer title="Driver Detail" onClose={onClose}>
      <div className="card" style={{ marginBottom: 12 }}>
        <div className="section-title">Profile</div>
        <div>{driver.fullName}</div>
        <div>{driver.vehicleType}</div>
        <div>{driver.plateNumber}</div>
      </div>
      <div className="card">
        <div className="section-title">Status</div>
        <Badge variant={driver.onlineStatus === 'ONLINE' ? 'success' : 'warning'}>
          {driver.onlineStatus}
        </Badge>
      </div>
    </Drawer>
  )
}

export default DriverDetailDrawer
