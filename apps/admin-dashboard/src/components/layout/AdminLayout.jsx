import Header from './Header.jsx';
import Sidebar from './Sidebar.jsx';

function AdminLayout({ children }) {
  return (
    <div className="app-shell">
      <Header />
      <div className="app-body">
        <Sidebar />
        <div className="app-main">
          <main className="app-content">{children}</main>
        </div>
      </div>
    </div>
  );
}

export default AdminLayout;
