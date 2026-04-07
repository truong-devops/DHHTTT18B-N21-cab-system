import Button from '../../common/Button.jsx';
import Table from '../../common/Table.jsx';
import DriverStatusBadge from './DriverStatusBadge.jsx';
import Badge from '../../common/Badge.jsx';
import { labelFrom, onlineStatusLabels, vehicleTypeLabels } from '../../../utils/labels.js';

function DriverTable({ drivers = [], onSelect, onApprove, onSuspend }) {
  const columns = [
    { key: 'fullName', header: 'Tài xế' },
    {
      key: 'vehicleType',
      header: 'Phương tiện',
      render: (row) => labelFrom(vehicleTypeLabels, row.vehicleType)
    },
    {
      key: 'onlineStatus',
      header: 'Trực tuyến',
      render: (row) => (
        <Badge variant={row.onlineStatus === 'ONLINE' ? 'success' : 'warning'}>{labelFrom(onlineStatusLabels, row.onlineStatus)}</Badge>
      )
    },
    {
      key: 'status',
      header: 'Trạng thái',
      render: (row) => <DriverStatusBadge status={row.status} />
    },
    {
      key: 'action',
      header: 'Thao tác',
      render: (row) => (
        <div style={{ display: 'flex', gap: 6 }}>
          <Button variant="ghost" onClick={() => onSelect?.(row)}>
            Xem
          </Button>
          <Button variant="outline" onClick={() => onApprove?.(row)}>
            Duyệt
          </Button>
          <Button variant="danger" onClick={() => onSuspend?.(row)}>
            Tạm khóa
          </Button>
        </div>
      )
    }
  ];

  return <Table columns={columns} data={drivers} total={drivers.length} />;
}

export default DriverTable;
