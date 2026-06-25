"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "../../lib/client-context";
import { ApiError } from "../../lib/api-client";
import { useTranslation } from "../../lib/i18n";

export default function LoginPage() {
  const { login } = useAuth();
  const { t } = useTranslation();
  const router = useRouter();
  const [email, setEmail] = useState("admin@assetx.local");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email, password);
      router.push("/");
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setError(t("login.error"));
      } else if (err instanceof ApiError) {
        setError(`${t("login.error")} (HTTP ${err.status})`);
      } else {
        setError(t("login.error"));
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="brand">
          <span className="brand-mark">A</span>
          AssetX
        </div>
        <p className="auth-sub">{t("login.title")}</p>

        <form onSubmit={onSubmit}>
          <div className="field">
            <label className="label" htmlFor="email">
              {t("login.email")}
            </label>
            <input
              id="email"
              className="input"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="field">
            <label className="label" htmlFor="password">
              {t("login.password")}
            </label>
            <input
              id="password"
              className="input"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {error && <div className="error-text">{error}</div>}

          <button className="btn block" type="submit" disabled={submitting}>
            {submitting ? t("login.submitting") : t("login.submit")}
          </button>
        </form>

        <p className="auth-sub" style={{ marginTop: 16 }}>
          <Link href="/signup">{t("login.toSignup")}</Link>
        </p>
      </div>
    </div>
  );
}
