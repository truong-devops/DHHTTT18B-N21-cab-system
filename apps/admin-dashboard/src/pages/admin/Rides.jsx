import { useEffect, useState } from 'react'
import Select from '../../components/common/Select.jsx'
import PageHeader from '../../components/common/PageHeader.jsx'
import RideTable from '../../components/admin/rides/RideTable.jsx'
import RideDetail from '../../components/admin/rides/RideDetail.jsx'
import { rideService } from '../../services/ride.service.js'
import { useToast } from '../../hooks/useToast.js'

function Rides() {
  const toast = useToast()
  const [status, setStatus] = useState('')
  const [rides, setRides] = useState([])
  const [selected, setSelected] = useState(null)

  useEffect(() => {
    async function load() {
      try {
        const result = await rideService.list({ status: status || undefined })
        setRides(result.items)
      } catch (error) {
        toast?.push(error.message || 'Không thể tải chuyến đi', 'danger')
      }
    }

    load()
  }, [status])

  return (
    <div>
      <PageHeader
        title="Chuyến đi"
        subtitle="Theo dõi vòng đời chuyến đi, hủy chuyến và bất thường dịch vụ."
      />
      <div className="card">
        <Select
          label="Trạng thái"
          value={status}
          onChange={(event) => setStatus(event.target.value)}
        >
          <option value="">Tất cả</option>
          <option value="completed">Hoàn thành</option>
          <option value="cancelled">Đã hủy</option>
          <option value="requested">Đã yêu cầu</option>
        </Select>
      </div>
      <div className="card">
        <RideTable rides={rides} onSelect={setSelected} />
      </div>
      <RideDetail ride={selected} onClose={() => setSelected(null)} />
    </div>
  )
}

export default Rides
