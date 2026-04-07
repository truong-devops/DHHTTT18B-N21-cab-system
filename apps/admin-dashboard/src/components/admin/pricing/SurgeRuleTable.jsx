import Badge from '../../common/Badge.jsx';
import Button from '../../common/Button.jsx';
import Table from '../../common/Table.jsx';
import { labelFrom, surgeStatusLabels } from '../../../utils/labels.js';

function SurgeRuleTable({ rules = [], onToggle }) {
  const columns = [
    { key: 'name', header: 'Quy tắc' },
    { key: 'zone', header: 'Khu vực' },
    { key: 'multiplier', header: 'Hệ số' },
    {
      key: 'status',
      header: 'Trạng thái',
      render: (row) => <Badge variant={row.status === 'ACTIVE' ? 'success' : 'warning'}>{labelFrom(surgeStatusLabels, row.status)}</Badge>
    },
    {
      key: 'action',
      header: 'Thao tác',
      render: (row) => (
        <Button variant="outline" onClick={() => onToggle?.(row)}>
          Bật/Tắt
        </Button>
      )
    }
  ];

  return <Table columns={columns} data={rules} total={rules.length} />;
}

export default SurgeRuleTable;
