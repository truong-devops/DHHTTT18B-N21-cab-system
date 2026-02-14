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
        <div className="section-title">Điều hành quản trị</div>
        <div style={{ fontWeight: 700, fontSize: 16 }}>
          {user?.email || 'Quản trị viên'}
        </div>
      </div>
      <div className="header-actions">
        <div className="header-search">
          <Input
            placeholder="Tìm chuyến đi, người dùng, tài xế"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <Button variant="outline">Thao tác nhanh</Button>
        <Button variant="ghost" onClick={logout}>
          Đăng xuất
        </Button>
      </div>
    </header>
  )
}

export default Header
