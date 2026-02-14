import Badge from '../../common/Badge.jsx'
import Table from '../../common/Table.jsx'
import Button from '../../common/Button.jsx'
import { labelFrom, rideStatusLabels } from '../../../utils/labels.js'

function RideTable({ rides = [], onSelect }) {
  const columns = [
    { key: 'id', header: 'Mã chuyến' },
    {
      key: 'rider',
      header: 'Hành khách',
      render: (row) => row.rider || row.riderId || '-',
    },
    {
      key: 'driver',
      header: 'Tài xế',
      render: (row) => row.driver || row.driverId || '-',
    },
    {
      key: 'fare',
      header: 'Cước phí',
      render: (row) =>
        row.fare !== null && row.fare !== undefined ? row.fare : 'Không có',
    },
    {
      key: 'status',
      header: 'Trạng thái',
      render: (row) => (
        <Badge variant={row.status === 'completed' ? 'success' : 'warning'}>
          {labelFrom(rideStatusLabels, row.status)}
        </Badge>
      ),
    },
    {
      key: 'action',
      header: 'Thao tác',
      render: (row) => (
        <Button variant="ghost" onClick={() => onSelect?.(row)}>
          Xem
        </Button>
      ),
    },
  ]

  return <Table columns={columns} data={rides} total={rides.length} />
}

export default RideTable
