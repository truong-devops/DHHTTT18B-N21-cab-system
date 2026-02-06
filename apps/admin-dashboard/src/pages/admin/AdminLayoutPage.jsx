import { Outlet } from 'react-router-dom'
import AdminLayout from '../../components/layout/AdminLayout.jsx'

function AdminLayoutPage() {
  return (
    <AdminLayout>
      <Outlet />
    </AdminLayout>
  )
}

export default AdminLayoutPage
