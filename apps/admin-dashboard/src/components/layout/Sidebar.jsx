import { NavLink } from 'react-router-dom'

const navItems = [
  { path: '/admin/dashboard', label: 'Tổng quan' },
  { path: '/admin/users', label: 'Người dùng' },
  { path: '/admin/drivers', label: 'Tài xế' },
  { path: '/admin/rides', label: 'Chuyến đi' },
  { path: '/admin/monitoring', label: 'Giám sát' },
  { path: '/admin/pricing', label: 'Giá cước' },
  { path: '/admin/logs', label: 'Nhật ký & Kiểm toán' },
]

function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div className="brand-mark">RX</div>
        <div>
          <div className="brand-title">RIDEX</div>
          <div className="brand-subtitle">Bảng điều hành quản trị</div>
        </div>
      </div>
      <nav className="sidebar-nav">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `sidebar-link${isActive ? ' active' : ''}`
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
      <div className="sidebar-footer">
        <span>Bảng điều hành</span>
        <span className="badge info">Trực tuyến</span>
      </div>
    </aside>
  )
}

export default Sidebar
