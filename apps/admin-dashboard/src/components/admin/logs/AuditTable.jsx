import Table from '../../common/Table.jsx'

function formatTime(value) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString()
}

function AuditTable({ audits = [] }) {
  const columns = [
    { key: 'timestamp', header: 'Time', render: (row) => formatTime(row.timestamp) },
    { key: 'actor', header: 'Actor' },
    { key: 'action', header: 'Action' },
    { key: 'target', header: 'Target' },
  ]

  return <Table columns={columns} data={audits} total={audits.length} />
}

export default AuditTable
