import { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../lib/api";

export default function Login() {
  const nav = useNavigate();
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("admin123");
  const [error, setError] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    try {
      const res = await api.post("/auth/login", { username, password });
      localStorage.setItem("accessToken", res.data.accessToken);
      nav("/");
    } catch (err) {
      setError(err?.response?.data?.message || "Đăng nhập thất bại");
    }
  };

  return (
    <div style={{ maxWidth: 420, margin: "80px auto", fontFamily: "Arial" }}>
      <h2>Đăng nhập quản trị</h2>
      <form onSubmit={submit}>
        <div style={{ marginBottom: 12 }}>
          <label>Tên đăng nhập</label>
          <input style={{ width: "100%" }} value={username} onChange={(e) => setUsername(e.target.value)} />
        </div>
        <div style={{ marginBottom: 12 }}>
          <label>Mật khẩu</label>
          <input
            style={{ width: "100%" }}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        {error && <p style={{ color: "red" }}>{error}</p>}
        <button type="submit">Đăng nhập</button>
      </form>
      <p style={{ opacity: 0.8, marginTop: 12 }}>Thử: <b>admin / admin123</b></p>
    </div>
  );
}
