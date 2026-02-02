import Drawer from '../../common/Drawer.jsx'
import Badge from '../../common/Badge.jsx'
import RideTimeline from './RideTimeline.jsx'

function RideDetail({ ride, onClose }) {
  if (!ride) return null

  return (
    <Drawer title="Ride Detail" onClose={onClose}>
      <div className="card" style={{ marginBottom: 12 }}>
        <div className="section-title">Summary</div>
        <div>Ride ID: {ride.id}</div>
        <div>Rider: {ride.rider}</div>
        <div>Driver: {ride.driver}</div>
        <Badge variant={ride.status === 'completed' ? 'success' : 'warning'}>
          {ride.status}
        </Badge>
      </div>
      <RideTimeline
        steps={[
          { label: 'Requested', time: '10:00' },
          { label: 'Assigned', time: '10:05' },
          { label: 'Completed', time: '10:25' },
        ]}
      />
    </Drawer>
  )
}

export default RideDetail
