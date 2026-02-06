import Button from '../../common/Button.jsx'
import Table from '../../common/Table.jsx'
import DriverStatusBadge from './DriverStatusBadge.jsx'
import Badge from '../../common/Badge.jsx'

function DriverTable({ drivers = [], onSelect, onApprove, onSuspend }) {
  const columns = [
    { key: 'fullName', header: 'Driver' },
    { key: 'vehicleType', header: 'Vehicle' },
    {
      key: 'onlineStatus',
      header: 'Online',
      render: (row) => (
        <Badge variant={row.onlineStatus === 'ONLINE' ? 'success' : 'warning'}>
          {row.onlineStatus}
        </Badge>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => <DriverStatusBadge status={row.status} />,
    },
    {
      key: 'action',
      header: 'Action',
      render: (row) => (
        <div style={{ display: 'flex', gap: 6 }}>
          <Button variant="ghost" onClick={() => onSelect?.(row)}>
            View
          </Button>
          <Button variant="outline" onClick={() => onApprove?.(row)}>
            Approve
          </Button>
          <Button variant="danger" onClick={() => onSuspend?.(row)}>
            Suspend
          </Button>
        </div>
      ),
    },
  ]

  return <Table columns={columns} data={drivers} total={drivers.length} />
}

export default DriverTable
