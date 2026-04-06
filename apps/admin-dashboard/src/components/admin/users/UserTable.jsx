import Badge from '../../common/Badge.jsx'
import Table from '../../common/Table.jsx'
import { labelFrom, roleLabels, userStatusLabels } from '../../../utils/labels.js'

function UserTable({ users = [], onSelect }) {
  const columns = [
    { key: 'id', header: 'User ID', render: (row) => <code>{row.id}</code> },
    { key: 'email', header: 'Email' },
    { key: 'fullName', header: 'Tên' },
    {
      key: 'role',
      header: 'Vai trò',
      render: (row) => labelFrom(roleLabels, row.role),
    },
    {
      key: 'status',
      header: 'Trạng thái',
      render: (row) => (
        <Badge variant={row.status === 'ACTIVE' ? 'success' : 'danger'}>
          {labelFrom(userStatusLabels, row.status)}
        </Badge>
      ),
    },
    {
      key: 'action',
      header: 'Thao tác',
      render: (row) => (
        <button className="btn btn-ghost" onClick={() => onSelect?.(row)}>
          Xem
        </button>
      ),
    },
  ]

  return <Table columns={columns} data={users} total={users.length} />
}

export default UserTable
