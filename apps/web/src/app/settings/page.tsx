"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../lib/client-context";
import type { AccountMembershipDTO } from "../../lib/types";
import {
  brandColorForAccount,
  toStorageUsage,
  toVaultMember,
  toVaultTenant,
} from "../../lib/vault/data";
import { BRAND_SWATCHES, type VaultMember, type VaultTenant } from "../../lib/vault/model";
import { Icon } from "../../components/ui/Icon";
import { Avatar } from "../../components/ui/Avatar";

type Tab = "branding" | "members" | "tenants";

export default function SettingsPage() {
  const {
    client,
    isAuthenticated,
    accounts,
    activeAccount,
    switchAccount,
    hasPermission,
  } = useAuth();
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState<Tab>("branding");
  const [members, setMembers] = useState<AccountMembershipDTO[]>([]);

  const activeId = activeAccount?.account.id ?? null;
  const [brandColor, setBrandColor] = useState<string>(
    activeId ? brandColorForAccount(activeId) : "#343ced",
  );
  const canManageMembers = hasPermission("members:read") || hasPermission("members:manage");

  useEffect(() => {
    const t = setTimeout(() => {
      if (!localStorage.getItem("assetx.accessToken")) {
        router.push("/login");
        return;
      }
      setReady(true);
    }, 50);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  const [savingBrand, setSavingBrand] = useState(false);
  const canUpdateAccount = hasPermission("account:update");
  const [usageLabel, setUsageLabel] = useState<string>("—");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [logoBusy, setLogoBusy] = useState(false);

  useEffect(() => {
    if (!activeId) return;
    setBrandColor(brandColorForAccount(activeId));
    client
      .getAccountSettings(activeId)
      .then((s) => {
        if (s.brandColor) setBrandColor(s.brandColor);
        setLogoUrl(s.logoUrl);
      })
      .catch(() => undefined);
    if (canManageMembers) {
      client
        .listMembers(activeId)
        .then((r) => setMembers(r.items))
        .catch(() => setMembers([]));
    }
    client
      .getAccountUsage(activeId)
      .then((u) => setUsageLabel(toStorageUsage(u).label))
      .catch(() => setUsageLabel("—"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId, tab]);

  const saveBrandColor = async (color: string) => {
    if (!activeId || !canUpdateAccount) return;
    setSavingBrand(true);
    try {
      const updated = await client.updateAccountSettings(activeId, {
        brandColor: color,
      });
      setBrandColor(updated.brandColor);
    } finally {
      setSavingBrand(false);
    }
  };

  const uploadLogo = async (file: File) => {
    if (!activeId || !canUpdateAccount) return;
    setLogoBusy(true);
    try {
      const updated = await client.uploadAccountLogo(activeId, file);
      setLogoUrl(updated.logoUrl);
    } finally {
      setLogoBusy(false);
    }
  };

  const removeLogo = async () => {
    if (!activeId || !canUpdateAccount) return;
    setLogoBusy(true);
    try {
      const updated = await client.removeAccountLogo(activeId);
      setLogoUrl(updated.logoUrl);
    } finally {
      setLogoBusy(false);
    }
  };

  if (!ready) {
    return (
      <div className="vault-empty">
        <div className="spinner" />
        <p>Loading settings…</p>
      </div>
    );
  }

  const tenantName = activeAccount?.account.name ?? "this workspace";

  return (
    <>
      <div className="vault-view-header" style={{ paddingBottom: 12 }}>
        <h1 className="vault-view-title">Settings</h1>
        <div className="vault-view-sub">
          Manage how {tenantName} looks and behaves across the workspace.
        </div>
      </div>

      <div className="vault-tabs">
        {(["branding", "members", "tenants"] as Tab[]).map((t) => (
          <button
            key={t}
            className={`vault-tab${tab === t ? " active" : ""}`}
            style={{ textTransform: "capitalize" }}
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="vault-main-scroll">
        <div className="vault-scroll-body">
          {tab === "branding" && (
            <BrandingTab
              tenantName={tenantName}
              brandColor={brandColor}
              canUpdate={canUpdateAccount}
              saving={savingBrand}
              onSelect={setBrandColor}
              onSave={saveBrandColor}
              logoUrl={logoUrl}
              logoBusy={logoBusy}
              onUploadLogo={uploadLogo}
              onRemoveLogo={removeLogo}
            />
          )}
          {tab === "members" && (
            <MembersTab members={members.map(toVaultMember)} />
          )}
          {tab === "tenants" && (
            <TenantsTab
              tenants={accounts.map((ctx) => {
                const tenant = toVaultTenant(ctx, activeId);
                // Usage is only resolvable for the active account today.
                return tenant.isCurrent
                  ? { ...tenant, storageLabel: usageLabel }
                  : tenant;
              })}
              onSwitch={(tid) => switchAccount(tid)}
            />
          )}
        </div>
      </div>
    </>
  );
}

function BrandingTab({
  tenantName,
  brandColor,
  canUpdate,
  saving,
  onSelect,
  onSave,
  logoUrl,
  logoBusy,
  onUploadLogo,
  onRemoveLogo,
}: {
  tenantName: string;
  brandColor: string;
  canUpdate: boolean;
  saving: boolean;
  onSelect: (c: string) => void;
  onSave: (c: string) => void | Promise<void>;
  logoUrl: string | null;
  logoBusy: boolean;
  onUploadLogo: (file: File) => void | Promise<void>;
  onRemoveLogo: () => void | Promise<void>;
}) {
  const logoInput = useRef<HTMLInputElement>(null);
  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 380px", gap: 36, maxWidth: 1100 }}>
      <div className="vault-panel">
        <h3 className="vault-section-label">Workspace identity</h3>
        <div className="vault-field">
          <label className="vault-field-label">Workspace name</label>
          <input className="vault-input" defaultValue={tenantName} />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div
            style={{
              width: 60,
              height: 60,
              borderRadius: 14,
              background: logoUrl ? "var(--surface-2)" : brandColor,
              overflow: "hidden",
              display: "grid",
              placeItems: "center",
            }}
          >
            {logoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logoUrl}
                alt="Workspace logo"
                style={{ width: "100%", height: "100%", objectFit: "contain" }}
              />
            )}
          </div>
          <button
            className="vault-btn"
            disabled={!canUpdate || logoBusy}
            onClick={() => logoInput.current?.click()}
          >
            {logoBusy ? "Uploading…" : logoUrl ? "Replace logo" : "Upload logo"}
          </button>
          {logoUrl && (
            <button
              className="vault-btn"
              disabled={!canUpdate || logoBusy}
              onClick={() => void onRemoveLogo()}
            >
              Remove
            </button>
          )}
          <input
            ref={logoInput}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/svg+xml"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void onUploadLogo(file);
              e.target.value = "";
            }}
          />
        </div>

        <div className="vault-divider" />

        <h3 className="vault-section-label">Brand color</h3>
        <div className="vault-swatches">
          {BRAND_SWATCHES.map((s) => {
            const selected = s.value.toLowerCase() === brandColor.toLowerCase();
            return (
              <button
                key={s.value}
                className={`vault-swatch${selected ? " selected" : ""}`}
                style={{ background: s.value, color: s.value }}
                aria-label={s.name}
                aria-pressed={selected}
                disabled={!canUpdate || saving}
                onClick={() => {
                  // Update the live preview immediately, then persist.
                  onSelect(s.value);
                  void onSave(s.value);
                }}
              >
                {selected && <Icon name="check" size={18} strokeWidth={3} className="" />}
              </button>
            );
          })}
        </div>

        <div className="vault-divider" />
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button
            className="vault-btn brand"
            disabled={!canUpdate || saving}
            onClick={() => void onSave(brandColor)}
          >
            {saving ? "Saving…" : "Save changes"}
          </button>
          {!canUpdate && (
            <span style={{ color: "var(--text-muted)", fontSize: 13 }}>
              You need account admin rights to change branding.
            </span>
          )}
        </div>
      </div>

      {/* Live preview */}
      <div style={{ position: "sticky", top: 0, alignSelf: "start" }}>
        <div className="vault-preview-card">
          <div className="vault-preview-accent" style={{ background: brandColor }} />
          <div style={{ padding: 24 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: brandColor, marginBottom: 16 }} />
            <h3 className="vault-display" style={{ margin: "0 0 4px" }}>{tenantName} portal</h3>
            <p style={{ color: "var(--text-muted)", fontSize: 14 }}>
              A live preview of your brand color across links and buttons.
            </p>
            <a style={{ color: brandColor, fontWeight: 600 }} href="#" onClick={(e) => e.preventDefault()}>
              Learn more →
            </a>
            <button
              className="vault-btn-primary block"
              style={{ background: brandColor, marginTop: 16 }}
            >
              Request access
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function MembersTab({ members }: { members: VaultMember[] }) {
  return (
    <div style={{ maxWidth: 1040 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div>
          <h2 className="vault-display" style={{ fontSize: 20, margin: 0 }}>Members</h2>
          <p style={{ color: "var(--text-muted)", margin: "4px 0 0" }}>
            People who can access this workspace.
          </p>
        </div>
        {/* TODO: wire invite to addMember modal. */}
        <button className="vault-btn brand">
          <Icon name="user-plus" size={16} />
          Invite members
        </button>
      </div>
      <table className="vault-table">
        <thead>
          <tr>
            <th>Member</th>
            <th>Role</th>
            <th>Status</th>
            <th>Last active</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {members.length === 0 ? (
            <tr>
              <td colSpan={5} style={{ color: "var(--text-muted)", textAlign: "center" }}>
                No members to show.
              </td>
            </tr>
          ) : (
            members.map((m) => (
              <tr key={m.id} style={{ cursor: "default" }}>
                <td>
                  <div className="vault-row-name">
                    <Avatar seed={m.email} size={36} color={m.avatarColor} />
                    <span>
                      <div style={{ fontWeight: 500 }}>{m.name}</div>
                      <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{m.email}</div>
                    </span>
                  </div>
                </td>
                <td style={{ color: "var(--text-muted)" }}>{m.role}</td>
                <td>
                  <span className={`vault-badge ${m.status === "Active" ? "active" : m.status === "Invited" ? "invited" : "neutral"}`}>
                    {m.status}
                  </span>
                </td>
                <td style={{ color: "var(--text-muted)" }}>{m.lastActive}</td>
                <td>
                  <button className="vault-icon-btn bare" aria-label="More">
                    <Icon name="more" size={18} />
                  </button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

function TenantsTab({
  tenants,
  onSwitch,
}: {
  tenants: VaultTenant[];
  onSwitch: (id: string) => void;
}) {
  return (
    <div style={{ maxWidth: 1040 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div>
          <h2 className="vault-display" style={{ fontSize: 20, margin: 0 }}>Tenants</h2>
          <p style={{ color: "var(--text-muted)", margin: "4px 0 0" }}>
            Workspaces managed under this organization. Each tenant has its own assets, branding, and members.
          </p>
        </div>
        <button className="vault-btn brand">
          <Icon name="plus" size={16} />
          New tenant
        </button>
      </div>
      <table className="vault-table">
        <thead>
          <tr>
            <th>Workspace</th>
            <th>Plan</th>
            <th>Members</th>
            <th>Storage</th>
            <th>Status</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {tenants.map((t) => (
            <tr
              key={t.id}
              className={t.isCurrent ? "selected" : ""}
              onClick={() => !t.isCurrent && onSwitch(t.id)}
              style={{ cursor: t.isCurrent ? "default" : "pointer" }}
            >
              <td>
                <div className="vault-row-name">
                  <span
                    className="vault-avatar"
                    style={{ width: 38, height: 38, borderRadius: 9, background: t.brandColor, color: "#fff", fontFamily: "var(--font-display)" }}
                  >
                    {t.name[0]?.toUpperCase()}
                  </span>
                  <span>
                    <div style={{ fontWeight: 600, display: "flex", gap: 8, alignItems: "center" }}>
                      {t.name}
                      {t.isCurrent && <span className="vault-badge current">Current</span>}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{t.domain}</div>
                  </span>
                </div>
              </td>
              <td>
                <span className={`vault-badge ${t.plan === "Enterprise" ? "plan-enterprise" : "neutral"}`}>
                  {t.plan}
                </span>
              </td>
              <td style={{ color: "var(--text-muted)" }}>{t.memberCount ?? "—"}</td>
              <td style={{ color: "var(--text-muted)" }}>{t.storageLabel}</td>
              <td>
                <span className={`vault-badge ${t.status === "Active" ? "active" : "suspended"}`}>
                  {t.status}
                </span>
              </td>
              <td>
                <button className="vault-icon-btn bare" aria-label="More" onClick={(e) => e.stopPropagation()}>
                  <Icon name="more" size={18} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
