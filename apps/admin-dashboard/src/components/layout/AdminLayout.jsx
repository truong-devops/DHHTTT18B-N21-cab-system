import Header from './Header.jsx';
import Sidebar from './Sidebar.jsx';

function AdminLayout({ children }) {
  return (
    <div className="app-shell">
      <Sidebar />
      <div className="app-main">
        <Header />
        <main className="app-content">{children}</main>
      </div>
    </div>
  );
}

export default AdminLayout;
