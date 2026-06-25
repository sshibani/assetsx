"use client";

import { useState } from "react";
import { Modal } from "../ui/Modal";
import { useAuth } from "../../lib/client-context";
import { useTranslation } from "../../lib/i18n";
import { ACCOUNT_ROLES, type AccountRole } from "@assetx/shared-types";

/** Invite a member to the active account (owner/super-admin). */
export function InviteMemberModal({
  accountId,
  canManageAdmins,
  onClose,
  onInvited,
}: {
  accountId: string;
  canManageAdmins: boolean;
  onClose: () => void;
  onInvited?: () => void;
}) {
  const { client } = useAuth();
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<AccountRole>("account_viewer");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const roles = ACCOUNT_ROLES.filter((r) =>
    r === "account_owner" ? canManageAdmins : true,
  );

  return (
    <Modal
      title={t("inviteModal.title")}
      width={460}
      onClose={onClose}
      footer={
        <>
          <button className="vault-btn" onClick={onClose} disabled={busy}>
            {t("common.cancel")}
          </button>
          <button
            className="vault-btn brand"
            disabled={busy || !email.trim()}
            onClick={async () => {
              setBusy(true);
              setError(null);
              try {
                await client.addMember(accountId, email.trim(), role);
                onInvited?.();
                onClose();
              } catch {
                setError(t("inviteModal.error"));
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? t("inviteModal.sending") : t("inviteModal.send")}
          </button>
        </>
      }
    >
      <div className="vault-field">
        <label className="vault-field-label">{t("inviteModal.email")}</label>
        <input
          className="vault-input"
          type="email"
          placeholder="user@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      <div className="vault-field" style={{ marginBottom: 0 }}>
        <label className="vault-field-label">{t("inviteModal.role")}</label>
        <select
          className="vault-input"
          value={role}
          onChange={(e) => setRole(e.target.value as AccountRole)}
        >
          {roles.map((r) => (
            <option key={r} value={r}>
              {t(`role.${r}`)}
            </option>
          ))}
        </select>
      </div>
      {error && (
        <p style={{ color: "var(--danger-fg)", marginTop: 12 }}>{error}</p>
      )}
    </Modal>
  );
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

/** Create a new tenant/workspace (super-admin only). */
export function CreateTenantModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated?: () => void;
}) {
  const { client } = useAuth();
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const effectiveSlug = slugEdited ? slug : slugify(name);

  return (
    <Modal
      title={t("tenantModal.title")}
      width={460}
      onClose={onClose}
      footer={
        <>
          <button className="vault-btn" onClick={onClose} disabled={busy}>
            {t("common.cancel")}
          </button>
          <button
            className="vault-btn brand"
            disabled={busy || !name.trim() || !effectiveSlug}
            onClick={async () => {
              setBusy(true);
              setError(null);
              try {
                await client.createAccount(name.trim(), effectiveSlug);
                onCreated?.();
                onClose();
              } catch {
                setError(t("tenantModal.error"));
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? t("common.creating") : t("tenantModal.create")}
          </button>
        </>
      }
    >
      <div className="vault-field">
        <label className="vault-field-label">{t("tenantModal.name")}</label>
        <input
          className="vault-input"
          placeholder="Acme Inc."
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>
      <div className="vault-field" style={{ marginBottom: 0 }}>
        <label className="vault-field-label">{t("tenantModal.slug")}</label>
        <input
          className="vault-input"
          placeholder="acme"
          value={effectiveSlug}
          onChange={(e) => {
            setSlugEdited(true);
            setSlug(slugify(e.target.value));
          }}
        />
        <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
          {t("tenantModal.slugHint")}
        </p>
      </div>
      {error && (
        <p style={{ color: "var(--danger-fg)", marginTop: 12 }}>{error}</p>
      )}
    </Modal>
  );
}
