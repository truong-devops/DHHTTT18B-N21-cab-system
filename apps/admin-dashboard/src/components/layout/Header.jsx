import { useState } from 'react'
import Button from '../common/Button.jsx'
import Input from '../common/Input.jsx'
import { useAuth } from '../../hooks/useAuth.js'

function Header() {
  const { user, logout } = useAuth()
  const [query, setQuery] = useState('')

  return (
    <header className="app-header">
      <div>
        <div className="section-title">Admin Operations</div>
        <div style={{ fontWeight: 700, fontSize: 16 }}>
          {user?.email || 'Admin'}
        </div>
      </div>
      <div className="header-actions">
        <div className="header-search">
          <Input
            placeholder="Search rides, users, drivers"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <Button variant="outline">Quick Actions</Button>
        <Button variant="ghost" onClick={logout}>
          Sign out
        </Button>
      </div>
    </header>
  )
}

export default Header
