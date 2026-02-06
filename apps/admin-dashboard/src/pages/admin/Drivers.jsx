import { useEffect, useState } from 'react'
import Select from '../../components/common/Select.jsx'
import DriverTable from '../../components/admin/drivers/DriverTable.jsx'
import DriverDetailDrawer from '../../components/admin/drivers/DriverDetailDrawer.jsx'
import { driverService } from '../../services/driver.service.js'
import { useToast } from '../../hooks/useToast.js'

function Drivers() {
  const toast = useToast()
  const [filters, setFilters] = useState({
    status: '',
    onlineStatus: '',
    vehicleType: '',
  })
  const [drivers, setDrivers] = useState([])
  const [selected, setSelected] = useState(null)

  useEffect(() => {
    async function load() {
      try {
        const result = await driverService.list({
          status: filters.status || undefined,
          onlineStatus: filters.onlineStatus || undefined,
          vehicleType: filters.vehicleType || undefined,
        })
        setDrivers(result.items)
      } catch (error) {
        toast?.push(error.message || 'Failed to load drivers', 'danger')
      }
    }

    load()
  }, [filters.status, filters.onlineStatus, filters.vehicleType])

  const handleApprove = async (driver) => {
    await driverService.approve(driver.id)
    toast?.push('Driver approved', 'success')
  }

  const handleSuspend = async (driver) => {
    await driverService.suspend(driver.id)
    toast?.push('Driver suspended', 'warning')
  }

  return (
    <div>
      <h1 className="page-title">Drivers</h1>
      <div className="card">
        <div className="grid grid-3">
          <Select
            label="Status"
            value={filters.status}
            onChange={(event) =>
              setFilters((prev) => ({ ...prev, status: event.target.value }))
            }
          >
            <option value="">All</option>
            <option value="APPROVED">APPROVED</option>
            <option value="PENDING">PENDING</option>
          </Select>
          <Select
            label="Online"
            value={filters.onlineStatus}
            onChange={(event) =>
              setFilters((prev) => ({
                ...prev,
                onlineStatus: event.target.value,
              }))
            }
          >
            <option value="">All</option>
            <option value="ONLINE">ONLINE</option>
            <option value="OFFLINE">OFFLINE</option>
          </Select>
          <Select
            label="Vehicle"
            value={filters.vehicleType}
            onChange={(event) =>
              setFilters((prev) => ({
                ...prev,
                vehicleType: event.target.value,
              }))
            }
          >
            <option value="">All</option>
            <option value="CAR">CAR</option>
            <option value="BIKE">BIKE</option>
          </Select>
        </div>
      </div>
      <div className="card">
        <DriverTable
          drivers={drivers}
          onSelect={setSelected}
          onApprove={handleApprove}
          onSuspend={handleSuspend}
        />
      </div>
      <DriverDetailDrawer driver={selected} onClose={() => setSelected(null)} />
    </div>
  )
}

export default Drivers
