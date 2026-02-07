import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Button from '../../components/common/Button.jsx'
import Input from '../../components/common/Input.jsx'
import { useAuth } from '../../hooks/useAuth.js'
import { useToast } from '../../hooks/useToast.js'

function AdminLogin() {
  const navigate = useNavigate()
  const { login, register } = useAuth()
  const toast = useToast()
  const [mode, setMode] = useState('login')
  const [form, setForm] = useState({ email: '', password: '' })

  const handleSubmit = async (event) => {
    event.preventDefault()
    try {
      if (mode === 'register') {
        await register(form)
        toast?.push('Registered. Please login.', 'success')
        setMode('login')
        return
      }

      await login(form)
      navigate('/admin/dashboard')
    } catch (error) {
      toast?.push(error.message || 'Auth failed', 'danger')
    }
  }

  return (
    <div className="auth-shell">
      <div className="card auth-card">
        <div className="auth-header">
          <div className="auth-mark">RX</div>
          <div>
            <h3 className="card-title">Admin Console</h3>
            <p className="auth-subtitle">
              Sign in to manage rides, drivers, and operations.
            </p>
          </div>
        </div>
        <div className="tabs">
          <div
            className={`tab ${mode === 'login' ? 'active' : ''}`}
            onClick={() => setMode('login')}
          >
            Login
          </div>
          <div
            className={`tab ${mode === 'register' ? 'active' : ''}`}
            onClick={() => setMode('register')}
          >
            Register
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
            label="Password"
            type="password"
            value={form.password}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, password: event.target.value }))
            }
          />
          <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
            <Button type="submit" variant="primary">
              {mode === 'login' ? 'Login' : 'Register'}
            </Button>
            <Button type="button" variant="outline">
              Need help?
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default AdminLogin
