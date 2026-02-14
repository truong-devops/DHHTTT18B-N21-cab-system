import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Button from '../../components/common/Button.jsx'
import Input from '../../components/common/Input.jsx'
import { useAuth } from '../../hooks/useAuth.js'
import { useToast } from '../../hooks/useToast.js'

function AdminLogin() {
  const navigate = useNavigate()
  const { login } = useAuth()
  const toast = useToast()
  const [form, setForm] = useState({ email: '', password: '' })

  const handleSubmit = async (event) => {
    event.preventDefault()
    try {
      await login(form)
      navigate('/admin/dashboard')
    } catch (error) {
      toast?.push(error.message || 'Xác thực thất bại', 'danger')
    }
  }

  return (
    <div className="auth-shell">
      <div className="card auth-card">
        <div className="auth-header">
          <div className="auth-mark">RX</div>
          <div>
            <h3 className="card-title">Bảng điều hành quản trị</h3>
            <p className="auth-subtitle">
              Đăng nhập để quản lý chuyến đi, tài xế và vận hành.
            </p>
          </div>
        </div>
        <form onSubmit={handleSubmit} style={{ marginTop: 16 }}>
          <Input
            label="Email"
            type="email"
            value={form.email}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, email: event.target.value }))
            }
          />
          <div style={{ height: 12 }} />
          <Input
            label="Mật khẩu"
            type="password"
            value={form.password}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, password: event.target.value }))
            }
          />
          <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
            <Button type="submit" variant="primary">
              Đăng nhập
            </Button>
            <Button type="button" variant="outline">
              Cần hỗ trợ?
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default AdminLogin
