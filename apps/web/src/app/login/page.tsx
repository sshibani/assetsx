"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../lib/client-context";
import { ApiError } from "../../lib/api-client";

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("admin@assetx.local");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await login(email, password);
      router.push("/");
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setError("Invalid credentials");
      } else if (err instanceof ApiError) {
        setError(`Login failed (HTTP ${err.status})`);
      } else {
        setError(
          err instanceof Error ? `Login error: ${err.message}` : "Login error",
        );
      }
    }
  };

  return (
    <div className="container" style={{ maxWidth: 360, marginTop: 80 }}>
      <h1>AssetX</h1>
      <form onSubmit={onSubmit}>
        <input
          className="input"
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          className="input"
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {error && <p style={{ color: "#e27e7e" }}>{error}</p>}
        <button className="btn" type="submit" style={{ width: "100%" }}>
          Log in
        </button>
      </form>
    </div>
  );
}
