"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../lib/client-context";
import { useTranslation } from "../../lib/i18n";
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
import {
  CreateTenantModal,
  InviteMemberModal,
} from "../../components/vault/settings-modals";

type Tab = "branding" | "members" | "tenants";

export default function SettingsPage() {
  const {
    client,
    isAuthenticated,
    accounts,
    activeAccount,
    switchAccount,
    hasPermission,
    isSuperUser,
  } = useAuth();
  const { t } = useTranslation();
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState<Tab>("branding");
  const [members, setMembers] = useState<AccountMembershipDTO[]>([]);
  const [modal, setModal] = useState<null | "invite" | "tenant">(null);

  const activeId = activeAccount?.account.id ?? null;
  const [brandColor, setBrandColor] = useState<string>(
    activeId ? brandColorForAccount(activeId) : "#343ced",
  );
  const canManageMembers = hasPermission("members:read") || hasPermission("members:manage");
  const canInviteMembers = hasPermission("members:manage");
  const canManageAdmins = hasPermission("members:manage_admins");

  const loadMembers = () => {
    if (!activeId || !canManageMembers) return;
    client
      .listMembers(activeId)
      .then((r) => setMembers(r.items))
      .catch(() => setMembers([]));
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      if (!localStorage.getItem("assetx.accessToken")) {
        router.push("/login");
        return;
      }
      setReady(true);
    }, 50);
    return () => clearTimeout(timer);
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
      // Notify the app shell so the accent applies app-wide immediately.
      window.dispatchEvent(
        new CustomEvent("assetx:branding-changed", {
          detail: { accountId: activeId, brandColor: updated.brandColor },
        }),
      );
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
      window.dispatchEvent(
        new CustomEvent("assetx:branding-changed", { detail: { accountId: activeId } }),
      );
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
      window.dispatchEvent(
        new CustomEvent("assetx:branding-changed", { detail: { accountId: activeId } }),
      );
    } finally {
      setLogoBusy(false);
    }
  };

  if (!ready) {
    return (
      <div className="vault-empty">
        <div className="spinner" />
        <p>{t("settings.loading")}</p>
      </div>
    );
  }

  const tenantName = activeAccount?.account.name ?? "this workspace";

  return (
    <>
      <div className="vault-view-header" style={{ paddingBottom: 12 }}>
        <h1 className="vault-view-title">{t("settings.title")}</h1>
        <div className="vault-view-sub">
          {t("settings.subtitle", { tenant: tenantName })}
        </div>
      </div>

      <div className="vault-tabs">
        {(["branding", "members", "tenants"] as Tab[]).map((tabKey) => (
          <button
            key={tabKey}
            className={`vault-tab${tab === tabKey ? " active" : ""}`}
            style={{ textTransform: "capitalize" }}
            onClick={() => setTab(tabKey)}
          >
            {t(`settings.tab.${tabKey}`)}
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
            <MembersTab
              members={members.map(toVaultMember)}
              canInvite={canInviteMembers}
              onInvite={() => setModal("invite")}
            />
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
              canCreate={isSuperUser}
              onCreate={() => setModal("tenant")}
              onSwitch={(tid) => switchAccount(tid)}
            />
          )}
        </div>
      </div>

      {modal === "invite" && activeId && (
        <InviteMemberModal
          accountId={activeId}
          canManageAdmins={canManageAdmins}
          onClose={() => setModal(null)}
          onInvited={loadMembers}
        />
      )}
      {modal === "tenant" && (
        <CreateTenantModal
          onClose={() => setModal(null)}
          onCreated={() => {
            // New account membership requires a token refresh to appear; a
            // simple reload re-hydrates accounts + permissions.
            window.location.reload();
          }}
        />
      )}
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
  const { t } = useTranslation();
  const logoInput = useRef<HTMLInputElement>(null);
  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 380px", gap: 36, maxWidth: 1100 }}>
      <div className="vault-panel">
        <h3 className="vault-section-label">{t("settings.workspaceIdentity")}</h3>
        <div className="vault-field">
          <label className="vault-field-label">{t("settings.workspaceName")}</label>
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
            {logoBusy ? t("account.uploadingAvatar") : logoUrl ? t("settings.replaceLogo") : t("settings.uploadLogo")}
          </button>
          {logoUrl && (
            <button
              className="vault-btn"
              disabled={!canUpdate || logoBusy}
              onClick={() => void onRemoveLogo()}
            >
              {t("common.remove")}
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

        <h3 className="vault-section-label">{t("settings.brandColor")}</h3>
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
            {saving ? t("common.saving") : t("settings.saveChanges")}
          </button>
          {!canUpdate && (
            <span style={{ color: "var(--text-muted)", fontSize: 13 }}>
              {t("settings.brandingPermission")}
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
            <h3 className="vault-display" style={{ margin: "0 0 4px" }}>{t("settings.portalPreview", { tenant: tenantName })}</h3>
            <p style={{ color: "var(--text-muted)", fontSize: 14 }}>
              {t("settings.previewBody")}
            </p>
            <a style={{ color: brandColor, fontWeight: 600 }} href="#" onClick={(e) => e.preventDefault()}>
              {t("settings.learnMore")}
            </a>
            <button
              className="vault-btn-primary block"
              style={{ background: brandColor, marginTop: 16 }}
            >
              {t("settings.requestAccess")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function MembersTab({
  members,
  canInvite,
  onInvite,
}: {
  members: VaultMember[];
  canInvite: boolean;
  onInvite: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div style={{ maxWidth: 1040 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div>
          <h2 className="vault-display" style={{ fontSize: 20, margin: 0 }}>{t("settings.members")}</h2>
          <p style={{ color: "var(--text-muted)", margin: "4px 0 0" }}>
            {t("settings.membersBody")}
          </p>
        </div>
        {canInvite && (
          <button className="vault-btn brand" onClick={onInvite}>
            <Icon name="user-plus" size={16} />
            {t("settings.inviteMembers")}
          </button>
        )}
      </div>
      <table className="vault-table">
        <thead>
          <tr>
            <th>{t("settings.col.member")}</th>
            <th>{t("settings.col.role")}</th>
            <th>{t("settings.col.status")}</th>
            <th>{t("settings.col.lastActive")}</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {members.length === 0 ? (
            <tr>
              <td colSpan={5} style={{ color: "var(--text-muted)", textAlign: "center" }}>
                {t("settings.noMembers")}
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
                    {t(`memberStatus.${m.status}`)}
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
  canCreate,
  onCreate,
  onSwitch,
}: {
  tenants: VaultTenant[];
  canCreate: boolean;
  onCreate: () => void;
  onSwitch: (id: string) => void;
}) {
  const { t } = useTranslation();
  return (
    <div style={{ maxWidth: 1040 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div>
          <h2 className="vault-display" style={{ fontSize: 20, margin: 0 }}>{t("settings.tenants")}</h2>
          <p style={{ color: "var(--text-muted)", margin: "4px 0 0" }}>
            {t("settings.tenantsBody")}
          </p>
        </div>
        {canCreate && (
          <button className="vault-btn brand" onClick={onCreate}>
            <Icon name="plus" size={16} />
            {t("settings.newTenant")}
          </button>
        )}
      </div>
      <table className="vault-table">
        <thead>
          <tr>
            <th>{t("settings.col.workspace")}</th>
            <th>{t("settings.col.plan")}</th>
            <th>{t("settings.col.members")}</th>
            <th>{t("settings.col.storage")}</th>
            <th>{t("settings.col.status")}</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {tenants.map((tenant) => (
            <tr
              key={tenant.id}
              className={tenant.isCurrent ? "selected" : ""}
              onClick={() => !tenant.isCurrent && onSwitch(tenant.id)}
              style={{ cursor: tenant.isCurrent ? "default" : "pointer" }}
            >
              <td>
                <div className="vault-row-name">
                  <span
                    className="vault-avatar"
                    style={{ width: 38, height: 38, borderRadius: 9, background: tenant.brandColor, color: "#fff", fontFamily: "var(--font-display)" }}
                  >
                    {tenant.name[0]?.toUpperCase()}
                  </span>
                  <span>
                    <div style={{ fontWeight: 600, display: "flex", gap: 8, alignItems: "center" }}>
                      {tenant.name}
                      {tenant.isCurrent && <span className="vault-badge current">{t("settings.current")}</span>}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{tenant.domain}</div>
                  </span>
                </div>
              </td>
              <td>
                <span className={`vault-badge ${tenant.plan === "Enterprise" ? "plan-enterprise" : "neutral"}`}>
                  {t(`plan.${tenant.plan}`)}
                </span>
              </td>
              <td style={{ color: "var(--text-muted)" }}>{tenant.memberCount ?? "—"}</td>
              <td style={{ color: "var(--text-muted)" }}>{tenant.storageLabel}</td>
              <td>
                <span className={`vault-badge ${tenant.status === "Active" ? "active" : "suspended"}`}>
                  {t(`tenantStatus.${tenant.status}`)}
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
