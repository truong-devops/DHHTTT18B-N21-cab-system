import Drawer from '../../common/Drawer.jsx'
import Badge from '../../common/Badge.jsx'
import RideTimeline from './RideTimeline.jsx'
import { labelFrom, rideStatusLabels } from '../../../utils/labels.js'

function RideDetail({ ride, onClose }) {
  if (!ride) return null

  return (
    <Drawer title="Chi tiết chuyến đi" onClose={onClose}>
      <div className="card" style={{ marginBottom: 12 }}>
        <div className="section-title">Tóm tắt</div>
        <div>Mã chuyến: {ride.id}</div>
        <div>Hành khách: {ride.rider || ride.riderId || '-'}</div>
        <div>Tài xế: {ride.driver || ride.driverId || '-'}</div>
        <Badge variant={ride.status === 'completed' ? 'success' : 'warning'}>
          {labelFrom(rideStatusLabels, ride.status)}
        </Badge>
      </div>
      <RideTimeline
        steps={[
          { label: 'Đã yêu cầu', time: '10:00' },
          { label: 'Đã gán tài xế', time: '10:05' },
          { label: 'Hoàn thành', time: '10:25' },
        ]}
      />
    </Drawer>
  )
}

export default RideDetail
