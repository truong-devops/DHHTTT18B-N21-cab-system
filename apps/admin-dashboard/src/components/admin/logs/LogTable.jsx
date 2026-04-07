import Badge from '../../common/Badge.jsx';
import Button from '../../common/Button.jsx';
import Table from '../../common/Table.jsx';
import { labelFrom, logLevelLabels } from '../../../utils/labels.js';

function toBadgeVariant(level) {
  if (level === 'ERROR') return 'danger';
  if (level === 'WARN') return 'warning';
  return 'info';
}

function formatTime(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function LogTable({ logs = [], onSelect }) {
  const columns = [
    {
      key: 'timestamp',
      header: 'Time',
      render: (row) => formatTime(row.timestamp)
    },
    { key: 'service', header: 'Service' },
    {
      key: 'level',
      header: 'Level',
      render: (row) => <Badge variant={toBadgeVariant(row.level)}>{labelFrom(logLevelLabels, row.level)}</Badge>
    },
    { key: 'message', header: 'Message' },
    {
      key: 'action',
      header: 'Action',
      render: (row) => (
        <Button variant="ghost" onClick={() => onSelect?.(row)}>
          View
        </Button>
      )
    }
  ];

  return <Table columns={columns} data={logs} total={logs.length} />;
}

export default LogTable;
