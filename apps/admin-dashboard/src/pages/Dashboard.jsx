import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../lib/api";

export default function Dashboard() {
  const nav = useNavigate();
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");

  const load = async () => {
    setErr("");
    try {
      const res = await api.get("/admin/summary");
      setData(res.data);
    } catch (e) {
      setErr(e?.response?.data?.message || "Failed to load");
    }
  };

  useEffect(() => { load(); }, []);

  const logout = async () => {
    try { await api.post("/auth/logout"); } catch {}
    localStorage.removeItem("accessToken");
    nav("/login");
  };

  return (
    <div style={{ padding: 24, fontFamily: "Arial" }}>
      <h1>Admin Dashboard</h1>
      <button onClick={logout}>Logout</button>
      <button style={{ marginLeft: 8 }} onClick={load}>Reload</button>

      {err && <p style={{ color: "red" }}>{err}</p>}
      {data ? (
        <pre style={{ marginTop: 16, background: "#f5f5f5", padding: 16 }}>
          {JSON.stringify(data, null, 2)}
        </pre>
      ) : (
        <p>Loading...</p>
      )}
    </div>
  );
}
