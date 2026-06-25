"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../lib/client-context";
import { LOCALES, type Locale, type UserDTO } from "../../lib/types";
import { Icon } from "../../components/ui/Icon";
import { Avatar } from "../../components/ui/Avatar";
import { useTranslation } from "../../lib/i18n";

const LOCALE_LABELS: Record<Locale, string> = {
  en: "English",
  nl: "Nederlands",
};

export default function AccountPage() {
  const { client, isAuthenticated, user } = useAuth();
  const router = useRouter();
  const { t } = useTranslation();
  const [ready, setReady] = useState(false);
  const [me, setMe] = useState<UserDTO | null>(null);
  const [savingLocale, setSavingLocale] = useState(false);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const avatarInput = useRef<HTMLInputElement>(null);

  // Change-password form
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwBusy, setPwBusy] = useState(false);
  const [pwMessage, setPwMessage] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (!localStorage.getItem("assetx.accessToken")) {
        router.push("/login");
        return;
      }
      setReady(true);
      client
        .getMe()
        .then(setMe)
        .catch(() => undefined);
    }, 50);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  const current = me ?? user;

  const notifyUserChanged = () =>
    window.dispatchEvent(new CustomEvent("assetx:user-changed"));

  const setLocale = async (locale: Locale) => {
    setSavingLocale(true);
    try {
      const updated = await client.updateMyLocale(locale);
      setMe(updated);
      notifyUserChanged();
    } finally {
      setSavingLocale(false);
    }
  };

  const uploadAvatar = async (file: File) => {
    setAvatarBusy(true);
    try {
      const updated = await client.uploadMyAvatar(file);
      setMe(updated);
      notifyUserChanged();
    } finally {
      setAvatarBusy(false);
    }
  };

  const removeAvatar = async () => {
    setAvatarBusy(true);
    try {
      const updated = await client.removeMyAvatar();
      setMe(updated);
      notifyUserChanged();
    } finally {
      setAvatarBusy(false);
    }
  };

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwMessage(null);
    if (newPassword !== confirmPassword) {
      setPwMessage({ ok: false, text: t("account.passwordMismatch") });
      return;
    }
    setPwBusy(true);
    try {
      await client.changeMyPassword(currentPassword, newPassword);
      setPwMessage({ ok: true, text: t("account.passwordUpdated") });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch {
      setPwMessage({ ok: false, text: t("account.passwordError") });
    } finally {
      setPwBusy(false);
    }
  };

  if (!ready || !current) {
    return (
      <div className="vault-empty">
        <div className="spinner" />
        <p>{t("common.loading")}</p>
      </div>
    );
  }

  const avatarUrl = me?.avatarUrl ?? null;

  return (
    <>
      <div className="vault-view-header">
        <h1 className="vault-view-title">{t("account.title")}</h1>
        <div className="vault-view-sub">{t("account.subtitle")}</div>
      </div>

      <div className="vault-main-scroll">
        <div className="vault-scroll-body">
          <div style={{ maxWidth: 640, display: "flex", flexDirection: "column", gap: 24 }}>
            {/* Profile */}
            <div className="vault-panel">
              <h3 className="vault-section-label">{t("account.profile")}</h3>
              <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 18 }}>
                {avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={avatarUrl}
                    alt="Your avatar"
                    style={{ width: 64, height: 64, borderRadius: 9999, objectFit: "cover" }}
                  />
                ) : (
                  <Avatar seed={current.email} size={64} />
                )}
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    className="vault-btn"
                    disabled={avatarBusy}
                    onClick={() => avatarInput.current?.click()}
                  >
                    {avatarBusy
                      ? t("account.uploadingAvatar")
                      : avatarUrl
                        ? t("account.replaceAvatar")
                        : t("account.uploadAvatar")}
                  </button>
                  {avatarUrl && (
                    <button className="vault-btn" disabled={avatarBusy} onClick={removeAvatar}>
                      {t("common.remove")}
                    </button>
                  )}
                  <input
                    ref={avatarInput}
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    hidden
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) void uploadAvatar(f);
                      e.target.value = "";
                    }}
                  />
                </div>
              </div>
              <div className="vault-field" style={{ marginBottom: 0 }}>
                <label className="vault-field-label">{t("account.email")}</label>
                <input className="vault-input" value={current.email} readOnly disabled />
              </div>
            </div>

            {/* Preferences */}
            <div className="vault-panel">
              <h3 className="vault-section-label">{t("account.preferences")}</h3>
              <div className="vault-field" style={{ marginBottom: 0 }}>
                <label className="vault-field-label">{t("account.language")}</label>
                <select
                  className="vault-input"
                  value={current.locale}
                  disabled={savingLocale}
                  onChange={(e) => void setLocale(e.target.value as Locale)}
                >
                  {LOCALES.map((l) => (
                    <option key={l} value={l}>
                      {LOCALE_LABELS[l]}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Security */}
            <div className="vault-panel">
              <h3 className="vault-section-label">{t("account.resetPassword")}</h3>
              <form onSubmit={changePassword}>
                <div className="vault-field">
                  <label className="vault-field-label">{t("account.currentPassword")}</label>
                  <input
                    className="vault-input"
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    autoComplete="current-password"
                  />
                </div>
                <div className="vault-field">
                  <label className="vault-field-label">{t("account.newPassword")}</label>
                  <input
                    className="vault-input"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    autoComplete="new-password"
                  />
                </div>
                <div className="vault-field">
                  <label className="vault-field-label">{t("account.confirmPassword")}</label>
                  <input
                    className="vault-input"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    autoComplete="new-password"
                  />
                </div>
                <button
                  className="vault-btn brand"
                  type="submit"
                  disabled={
                    pwBusy ||
                    !currentPassword ||
                    newPassword.length < 8 ||
                    !confirmPassword
                  }
                >
                  {pwBusy ? t("account.updatingPassword") : t("account.updatePassword")}
                </button>
                {pwMessage && (
                  <p
                    style={{
                      marginTop: 10,
                      fontSize: 13,
                      color: pwMessage.ok ? "var(--success)" : "var(--danger-fg)",
                    }}
                  >
                    {pwMessage.text}
                  </p>
                )}
              </form>
            </div>

            <div className="vault-panel">
              <h3 className="vault-section-label">{t("account.session")}</h3>
              <button
                className="vault-btn danger"
                onClick={() => {
                  localStorage.removeItem("assetx.accessToken");
                  router.push("/login");
                }}
              >
                <Icon name="arrow-left" size={16} />
                {t("common.logout")}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
