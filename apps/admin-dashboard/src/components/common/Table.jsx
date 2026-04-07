import Button from './Button.jsx';

function Table({
  columns = [],

  data = [],

  emptyText = 'Không có dữ liệu',
  page = 1,

  pageSize = 10,

  total = 0,

  onPageChange
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div>
      <table className="table">
        <thead>
          <tr>
            {columns.map((col) => (
              <th key={col.key || col.header}>{col.header}</th>
            ))}
          </tr>
        </thead>

        <tbody>
          {data.length === 0 && (
            <tr>
              <td colSpan={columns.length}>{emptyText}</td>
            </tr>
          )}

          {data.map((row, index) => (
            <tr key={row.id || index}>
              {columns.map((col) => (
                <td key={col.key || col.header}>{col.render ? col.render(row) : row[col.key]}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      <div className="table-footer">
        <span>
          Trang {page} / {totalPages}
        </span>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button variant="ghost" disabled={page <= 1} onClick={() => onPageChange?.(page - 1)}>
            Trước
          </Button>
          <Button variant="ghost" disabled={page >= totalPages} onClick={() => onPageChange?.(page + 1)}>
            Tiếp
          </Button>
        </div>
      </div>
    </div>
  );
}

export default Table;
