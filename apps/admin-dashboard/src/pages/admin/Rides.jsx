import { useEffect, useState } from 'react'
import Select from '../../components/common/Select.jsx'
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
        toast?.push(error.message || 'Failed to load rides', 'danger')
      }
    }

    load()
  }, [status])

  return (
    <div>
      <h1 className="page-title">Rides</h1>
      <div className="card">
        <Select
          label="Status"
          value={status}
          onChange={(event) => setStatus(event.target.value)}
        >
          <option value="">All</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
          <option value="requested">Requested</option>
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
