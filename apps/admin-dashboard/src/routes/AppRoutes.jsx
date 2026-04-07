import { Navigate, Route, Routes } from 'react-router-dom';

import { useAuth } from '../hooks/useAuth.js';

import AdminLayoutPage from '../pages/admin/AdminLayoutPage.jsx';

import AdminLogin from '../pages/admin/AdminLogin.jsx';

import Dashboard from '../pages/admin/Dashboard.jsx';

import Users from '../pages/admin/Users.jsx';

import Drivers from '../pages/admin/Drivers.jsx';

import Rides from '../pages/admin/Rides.jsx';

import Monitoring from '../pages/admin/Monitoring.jsx';

import Pricing from '../pages/admin/Pricing.jsx';

import LogsAudit from '../pages/admin/LogsAudit.jsx';

import Payments from '../pages/admin/Payments.jsx';

function RequireAdmin({ children }) {
  const { user, ready, hasRole } = useAuth();

  if (!ready) {
    return <div className="app-content">Đang tải...</div>;
  }

  if (!user) {
    return <Navigate to="/admin/login" replace />;
  }

  if (!hasRole(['admin', 'ops'])) {
    return <Navigate to="/admin/login" replace />;
  }

  return children;
}

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/admin/dashboard" replace />} />

      <Route path="/admin/login" element={<AdminLogin />} />

      <Route
        path="/admin"
        element={
          <RequireAdmin>
            <AdminLayoutPage />
          </RequireAdmin>
        }
      >
        <Route index element={<Navigate to="dashboard" replace />} />

        <Route path="dashboard" element={<Dashboard />} />

        <Route path="users" element={<Users />} />

        <Route path="drivers" element={<Drivers />} />

        <Route path="rides" element={<Rides />} />

        <Route path="monitoring" element={<Monitoring />} />

        <Route path="pricing" element={<Pricing />} />

        <Route path="payments" element={<Payments />} />

        <Route path="logs" element={<LogsAudit />} />
      </Route>

      <Route path="*" element={<Navigate to="/admin/dashboard" replace />} />
    </Routes>
  );
}
