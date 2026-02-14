import { useEffect, useState } from 'react'
import Select from '../../components/common/Select.jsx'
import PageHeader from '../../components/common/PageHeader.jsx'
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
        toast?.push(error.message || 'Không thể tải tài xế', 'danger')
      }
    }

    load()
  }, [filters.status, filters.onlineStatus, filters.vehicleType])

  const handleApprove = async (driver) => {
    try {
      await driverService.approve(driver.id)
      setDrivers((prev) =>
        prev.map((item) =>
          item.id === driver.id ? { ...item, status: 'APPROVED' } : item
        )
      )
      toast?.push('Đã duyệt tài xế', 'success')
    } catch (error) {
      toast?.push(error.message || 'Không thể duyệt tài xế', 'danger')
    }
  }

  const handleSuspend = async (driver) => {
    try {
      await driverService.suspend(driver.id)
      setDrivers((prev) =>
        prev.map((item) =>
          item.id === driver.id
            ? { ...item, status: 'SUSPENDED', onlineStatus: 'OFFLINE' }
            : item
        )
      )
      toast?.push('Đã tạm khóa tài xế', 'warning')
    } catch (error) {
      toast?.push(error.message || 'Không thể tạm khóa tài xế', 'danger')
    }
  }

  return (
    <div>
      <PageHeader
        title="Tài xế"
        subtitle="Xác thực hồ sơ, tuân thủ và trạng thái sẵn sàng."
      />
      <div className="card">
        <div className="grid grid-3">
          <Select
            label="Trạng thái"
            value={filters.status}
            onChange={(event) =>
              setFilters((prev) => ({ ...prev, status: event.target.value }))
            }
          >
            <option value="">Tất cả</option>
            <option value="APPROVED">Đã duyệt</option>
            <option value="PENDING">Chờ duyệt</option>
          </Select>
          <Select
            label="Trực tuyến"
            value={filters.onlineStatus}
            onChange={(event) =>
              setFilters((prev) => ({
                ...prev,
                onlineStatus: event.target.value,
              }))
            }
          >
            <option value="">Tất cả</option>
            <option value="ONLINE">Trực tuyến</option>
            <option value="OFFLINE">Ngoại tuyến</option>
          </Select>
          <Select
            label="Phương tiện"
            value={filters.vehicleType}
            onChange={(event) =>
              setFilters((prev) => ({
                ...prev,
                vehicleType: event.target.value,
              }))
            }
          >
            <option value="">Tất cả</option>
            <option value="CAR">Ô tô</option>
            <option value="BIKE">Xe máy</option>
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
