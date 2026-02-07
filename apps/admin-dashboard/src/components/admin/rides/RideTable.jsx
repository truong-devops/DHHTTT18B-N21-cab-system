import Badge from '../../common/Badge.jsx'
import Table from '../../common/Table.jsx'
import Button from '../../common/Button.jsx'

function RideTable({ rides = [], onSelect }) {
  const columns = [
    { key: 'id', header: 'Ride ID' },
    {
      key: 'rider',
      header: 'Rider',
      render: (row) => row.rider || row.riderId || '-',
    },
    {
      key: 'driver',
      header: 'Driver',
      render: (row) => row.driver || row.driverId || '-',
    },
    {
      key: 'fare',
      header: 'Fare',
      render: (row) => (row.fare !== null && row.fare !== undefined ? row.fare : 'N/A'),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => (
        <Badge variant={row.status === 'completed' ? 'success' : 'warning'}>
          {row.status}
        </Badge>
      ),
    },
    {
      key: 'action',
      header: 'Action',
      render: (row) => (
        <Button variant="ghost" onClick={() => onSelect?.(row)}>
          View
        </Button>
      ),
    },
  ]

  return <Table columns={columns} data={rides} total={rides.length} />
}

export default RideTable
