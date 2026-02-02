import Badge from '../../common/Badge.jsx'
import Table from '../../common/Table.jsx'
import Button from '../../common/Button.jsx'

function RideTable({ rides = [], onSelect }) {
  const columns = [
    { key: 'id', header: 'Ride ID' },
    { key: 'rider', header: 'Rider' },
    { key: 'driver', header: 'Driver' },
    { key: 'fare', header: 'Fare' },
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
