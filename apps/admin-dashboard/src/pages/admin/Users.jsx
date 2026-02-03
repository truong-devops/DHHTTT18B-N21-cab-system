import { useEffect, useState } from 'react'
import Input from '../../components/common/Input.jsx'
import Select from '../../components/common/Select.jsx'
import UserTable from '../../components/admin/users/UserTable.jsx'
import UserDetailDrawer from '../../components/admin/users/UserDetailDrawer.jsx'
import { userService } from '../../services/user.service.js'
import { useDebounce } from '../../hooks/useDebounce.js'
import { useToast } from '../../hooks/useToast.js'

function Users() {
  const toast = useToast()
  const [filters, setFilters] = useState({ search: '', status: '', role: '' })
  const [users, setUsers] = useState([])
  const [selected, setSelected] = useState(null)
  const debouncedSearch = useDebounce(filters.search, 300)

  useEffect(() => {
    async function load() {
      try {
        const result = await userService.list({
          search: debouncedSearch,
          status: filters.status || undefined,
          role: filters.role || undefined,
        })
        setUsers(result.items)
      } catch (error) {
        toast?.push(error.message || 'Failed to load users', 'danger')
      }
    }

    load()
  }, [debouncedSearch, filters.status, filters.role])

  return (
    <div>
      <h1 className="page-title">Users</h1>
      <div className="card">
        <div className="grid grid-3">
          <Input
            label="Search"
            placeholder="email"
            value={filters.search}
            onChange={(event) =>
              setFilters((prev) => ({ ...prev, search: event.target.value }))
            }
          />
          <Select
            label="Status"
            value={filters.status}
            onChange={(event) =>
              setFilters((prev) => ({ ...prev, status: event.target.value }))
            }
          >
            <option value="">All</option>
            <option value="ACTIVE">ACTIVE</option>
            <option value="SUSPENDED">SUSPENDED</option>
          </Select>
          <Select
            label="Role"
            value={filters.role}
            onChange={(event) =>
              setFilters((prev) => ({ ...prev, role: event.target.value }))
            }
          >
            <option value="">All</option>
            <option value="customer">Customer</option>
            <option value="driver">Driver</option>
            <option value="ops">Ops</option>
          </Select>
        </div>
      </div>
      <div className="card">
        <UserTable users={users} onSelect={setSelected} />
      </div>
      <UserDetailDrawer
        user={selected}
        onClose={() => setSelected(null)}
        onToggleStatus={() => toast?.push('Status updated', 'success')}
      />
    </div>
  )
}

export default Users
