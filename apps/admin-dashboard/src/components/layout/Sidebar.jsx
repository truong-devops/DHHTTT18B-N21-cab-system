import { NavLink } from 'react-router-dom';

const navItems = [
  { path: '/admin/dashboard', label: 'Tổng quan' },
  { path: '/admin/users', label: 'Người dùng' },
  { path: '/admin/drivers', label: 'Tài xế' },
  { path: '/admin/rides', label: 'Chuyến đi' },
  { path: '/admin/monitoring', label: 'Giám sát' },
  { path: '/admin/pricing', label: 'Giá cước' },
  { path: '/admin/payments', label: 'Thanh toán QR' },
  { path: '/admin/logs', label: 'Nhật ký & Kiểm toán' }
];

function Sidebar() {
  return (
    <aside className="sidebar">
      <nav className="sidebar-nav">
        {navItems.map((item) => (
          <NavLink key={item.path} to={item.path} className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}>
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-footer">
        <span>Hệ thống vận hành</span>
        <span className="badge info">Trực tuyến</span>
      </div>
    </aside>
  );
}

export default Sidebar;
