import { NavLink } from 'react-router-dom'

const navItems = [
  { path: '/admin/dashboard', label: 'Dashboard' },
  { path: '/admin/users', label: 'Users' },
  { path: '/admin/drivers', label: 'Drivers' },
  { path: '/admin/rides', label: 'Rides' },
  { path: '/admin/monitoring', label: 'Monitoring' },
  { path: '/admin/pricing', label: 'Pricing' },
  { path: '/admin/logs', label: 'Logs & Audit' },
]

function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div className="brand-mark">RX</div>
        <div>
          <div className="brand-title">RIDEX</div>
          <div className="brand-subtitle">Admin Console</div>
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
        <span>Operational Console</span>
        <span className="badge info">Live</span>
      </div>
    </aside>
  )
}

export default Sidebar
