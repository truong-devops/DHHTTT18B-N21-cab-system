import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';

export default function Dashboard() {
  const nav = useNavigate();
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');

  const load = async () => {
    setErr('');
    try {
      const res = await api.get('/admin/summary');
      setData(res.data);
    } catch (e) {
      setErr(e?.response?.data?.error?.message || e?.message || 'Khong the tai du lieu');
    }
  };

  useEffect(() => {
    load();
  }, []);

  const logout = async () => {
    try {
      const refreshToken = localStorage.getItem('refreshToken');
      await api.post('/v1/auth/logout', refreshToken ? { refreshToken } : {});
    } catch {}

    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    nav('/admin/login');
  };

  return (
    <div style={{ padding: 24, fontFamily: 'Arial' }}>
      <h1>Bang dieu khien quan tri</h1>
      <button onClick={logout}>Dang xuat</button>
      <button style={{ marginLeft: 8 }} onClick={load}>
        Tai lai
      </button>

      {err && <p style={{ color: 'red' }}>{err}</p>}

      {data ? <pre style={{ marginTop: 16, background: '#f5f5f5', padding: 16 }}>{JSON.stringify(data, null, 2)}</pre> : <p>Dang tai...</p>}
    </div>
  );
}
