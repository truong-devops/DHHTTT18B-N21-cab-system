import Badge from '../../common/Badge.jsx'
import Table from '../../common/Table.jsx'

function UserTable({ users = [], onSelect }) {
  const columns = [
    { key: 'email', header: 'Email' },
    { key: 'fullName', header: 'Name' },
    { key: 'role', header: 'Role' },
    {
      key: 'status',
      header: 'Status',
      render: (row) => (
        <Badge variant={row.status === 'ACTIVE' ? 'success' : 'danger'}>
          {row.status}
        </Badge>
      ),
    },
    {
      key: 'action',
      header: 'Action',
      render: (row) => (
        <button className="btn btn-ghost" onClick={() => onSelect?.(row)}>
          View
        </button>
      ),
    },
  ]

  return <Table columns={columns} data={users} total={users.length} />
}

export default UserTable
