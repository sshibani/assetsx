"use client";

import { useState } from "react";
import { Modal } from "../ui/Modal";
import { useAuth } from "../../lib/client-context";
import { ACCOUNT_ROLES, type AccountRole } from "@assetx/shared-types";

const ROLE_LABEL: Record<AccountRole, string> = {
  account_owner: "Owner",
  account_editor: "Editor",
  account_viewer: "Viewer",
};

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
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<AccountRole>("account_viewer");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const roles = ACCOUNT_ROLES.filter((r) =>
    r === "account_owner" ? canManageAdmins : true,
  );

  return (
    <Modal
      title="Invite member"
      width={460}
      onClose={onClose}
      footer={
        <>
          <button className="vault-btn" onClick={onClose} disabled={busy}>
            Cancel
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
                setError("Could not invite this member.");
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? "Inviting…" : "Send invite"}
          </button>
        </>
      }
    >
      <div className="vault-field">
        <label className="vault-field-label">Email</label>
        <input
          className="vault-input"
          type="email"
          placeholder="user@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      <div className="vault-field" style={{ marginBottom: 0 }}>
        <label className="vault-field-label">Role</label>
        <select
          className="vault-input"
          value={role}
          onChange={(e) => setRole(e.target.value as AccountRole)}
        >
          {roles.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABEL[r]}
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
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const effectiveSlug = slugEdited ? slug : slugify(name);

  return (
    <Modal
      title="New tenant"
      width={460}
      onClose={onClose}
      footer={
        <>
          <button className="vault-btn" onClick={onClose} disabled={busy}>
            Cancel
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
                setError("Could not create the tenant (slug may be taken).");
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? "Creating…" : "Create tenant"}
          </button>
        </>
      }
    >
      <div className="vault-field">
        <label className="vault-field-label">Workspace name</label>
        <input
          className="vault-input"
          placeholder="Acme Inc."
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>
      <div className="vault-field" style={{ marginBottom: 0 }}>
        <label className="vault-field-label">Slug</label>
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
          Lowercase letters, numbers and hyphens. Used in URLs.
        </p>
      </div>
      {error && (
        <p style={{ color: "var(--danger-fg)", marginTop: 12 }}>{error}</p>
      )}
    </Modal>
  );
}
