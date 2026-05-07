import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';

export default function Login() {
  const nav = useNavigate();
  const [identifier, setIdentifier] = useState('admin@cab.local');
  const [password, setPassword] = useState('password');
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setError('');

    try {
      const res = await api.post('/v1/auth/login', { identifier, password });
      const accessToken = res?.data?.tokens?.accessToken || '';
      const refreshToken = res?.data?.tokens?.refreshToken || '';

      if (!accessToken) {
        throw new Error('Missing access token');
      }

      localStorage.setItem('accessToken', accessToken);
      if (refreshToken) {
        localStorage.setItem('refreshToken', refreshToken);
      }

      nav('/admin/dashboard');
    } catch (err) {
      setError(err?.response?.data?.error?.message || err?.message || 'Dang nhap that bai');
    }
  };

  return (
    <div style={{ maxWidth: 420, margin: '80px auto', fontFamily: 'Arial' }}>
      <h2>Dang nhap quan tri</h2>
      <form onSubmit={submit}>
        <div style={{ marginBottom: 12 }}>
          <label>Email/Username</label>
          <input style={{ width: '100%' }} value={identifier} onChange={(e) => setIdentifier(e.target.value)} />
        </div>
        <div style={{ marginBottom: 12 }}>
          <label>Mat khau</label>
          <input style={{ width: '100%' }} type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        {error && <p style={{ color: 'red' }}>{error}</p>}
        <button type="submit">Dang nhap</button>
      </form>
      <p style={{ opacity: 0.8, marginTop: 12 }}>
        Thu: <b>admin@cab.local / password</b>
      </p>
    </div>
  );
}
