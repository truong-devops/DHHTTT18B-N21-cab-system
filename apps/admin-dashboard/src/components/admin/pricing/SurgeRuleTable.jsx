import Badge from '../../common/Badge.jsx'
import Button from '../../common/Button.jsx'
import Table from '../../common/Table.jsx'

function SurgeRuleTable({ rules = [], onToggle }) {
  const columns = [
    { key: 'name', header: 'Rule' },
    { key: 'zone', header: 'Zone' },
    { key: 'multiplier', header: 'Multiplier' },
    {
      key: 'status',
      header: 'Status',
      render: (row) => (
        <Badge variant={row.status === 'ACTIVE' ? 'success' : 'warning'}>
          {row.status}
        </Badge>
      ),
    },
    {
      key: 'action',
      header: 'Action',
      render: (row) => (
        <Button variant="outline" onClick={() => onToggle?.(row)}>
          Toggle
        </Button>
      ),
    },
  ]

  return <Table columns={columns} data={rules} total={rules.length} />
}

export default SurgeRuleTable
