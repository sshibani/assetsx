"use client";

import { useEffect, useState } from "react";
import { Modal } from "../ui/Modal";
import { Icon } from "../ui/Icon";
import { useAuth } from "../../lib/client-context";
import { useTranslation } from "../../lib/i18n";
import type { BundleDTO } from "../../lib/types";

/** Delete confirmation. onConfirm performs the real mutation. */
export function DeleteModal({
  count,
  noun = "asset",
  onClose,
  onConfirm,
}: {
  count: number;
  noun?: string;
  onClose: () => void;
  onConfirm: () => Promise<void> | void;
}) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const nounLabel = t(noun === "bundle" ? "noun.bundle" : "noun.asset");
  return (
    <Modal
      title={t("modal.delete.title", { count, noun: nounLabel })}
      width={420}
      onClose={onClose}
      footer={
        <>
          <button className="vault-btn" onClick={onClose} disabled={busy}>
            {t("common.cancel")}
          </button>
          <button
            className="vault-btn danger"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await onConfirm();
                onClose();
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? t("common.deleting") : t("common.delete")}
          </button>
        </>
      }
    >
      <div className="vault-delete-icon">
        <Icon name="trash" size={22} />
      </div>
      <p style={{ textAlign: "center", color: "var(--text-muted)", margin: 0 }}>
        {t("modal.delete.body", { noun: nounLabel })}
      </p>
    </Modal>
  );
}

/** Create a new bundle. onCreated receives the created bundle. */
export function CreateBundleModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated?: (bundle: BundleDTO) => void;
}) {
  const { client } = useAuth();
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState<"workspace" | "private">("workspace");
  const [busy, setBusy] = useState(false);

  return (
    <Modal
      title={t("modal.createBundle.title")}
      width={500}
      onClose={onClose}
      footer={
        <>
          <button className="vault-btn" onClick={onClose} disabled={busy}>
            {t("common.cancel")}
          </button>
          <button
            className="vault-btn brand"
            disabled={busy || name.trim().length === 0}
            onClick={async () => {
              setBusy(true);
              try {
                const bundle = await client.createBundle({
                  title: name.trim(),
                  description: description.trim() || undefined,
                });
                // TODO(ASS-50): persist visibility when bundle sharing supports it.
                onCreated?.(bundle);
                onClose();
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? t("common.creating") : t("modal.createBundle.submit")}
          </button>
        </>
      }
    >
      <div className="vault-field">
        <label className="vault-field-label">{t("modal.createBundle.name")}</label>
        <input
          className="vault-input"
          value={name}
          maxLength={255}
          placeholder={t("modal.createBundle.namePlaceholder")}
          onChange={(e) => setName(e.target.value)}
        />
      </div>
      <div className="vault-field">
        <label className="vault-field-label">{t("modal.createBundle.description")}</label>
        <textarea
          className="vault-input"
          value={description}
          maxLength={5000}
          placeholder={t("modal.createBundle.descriptionPlaceholder")}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>
      <div className="vault-field" style={{ marginBottom: 0 }}>
        <label className="vault-field-label">{t("modal.createBundle.visibility")}</label>
        <div className="vault-radio-cards">
          <div
            className={`vault-radio-card${visibility === "workspace" ? " selected" : ""}`}
            onClick={() => setVisibility("workspace")}
          >
            <strong>{t("modal.createBundle.workspace")}</strong>
            <div style={{ color: "var(--text-muted)" }}>{t("modal.createBundle.workspaceHint")}</div>
          </div>
          <div
            className={`vault-radio-card${visibility === "private" ? " selected" : ""}`}
            onClick={() => setVisibility("private")}
          >
            <strong>{t("modal.createBundle.private")}</strong>
            <div style={{ color: "var(--text-muted)" }}>{t("modal.createBundle.privateHint")}</div>
          </div>
        </div>
      </div>
    </Modal>
  );
}

/** Add selected assets to one or more bundles. */
export function AddToBundleModal({
  selectedCount,
  assetIds,
  onClose,
  onDone,
}: {
  selectedCount: number;
  assetIds: string[];
  onClose: () => void;
  onDone?: () => void;
}) {
  const { client } = useAuth();
  const { t } = useTranslation();
  const [bundles, setBundles] = useState<BundleDTO[]>([]);
  const [query, setQuery] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    client
      .listBundles()
      .then((r) => setBundles(r.items))
      .catch(() => undefined);
  }, [client]);

  const filtered = bundles.filter((b) =>
    b.title.toLowerCase().includes(query.toLowerCase()),
  );

  const addToBundle = async (bundleId: string) => {
    setBusyId(bundleId);
    try {
      await Promise.allSettled(
        assetIds.map((assetId) => client.addAssetToBundle(bundleId, assetId)),
      );
      onDone?.();
      onClose();
    } finally {
      setBusyId(null);
    }
  };

  return (
    <>
      <Modal
        title={t("modal.addToBundle.title")}
        width={480}
        onClose={onClose}
        footer={
          <button className="vault-btn" onClick={onClose}>
            {t("common.cancel")}
          </button>
        }
      >
        <p style={{ color: "var(--text-muted)", marginTop: 0 }}>
          {t("modal.addToBundle.subtitle", { count: selectedCount })}
        </p>
        <div className="vault-search" style={{ width: "100%", marginBottom: 12 }}>
          <Icon name="search" size={16} />
          <input
            placeholder={t("modal.addToBundle.searchPlaceholder")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <button
          className="vault-list-row"
          style={{ width: "100%", border: "none", background: "none", cursor: "pointer", textAlign: "left" }}
          onClick={() => setCreating(true)}
        >
          <span
            className="vault-avatar"
            style={{ width: 44, height: 44, borderRadius: 10, background: "var(--brand-tint)", color: "var(--brand)" }}
          >
            <Icon name="plus" size={18} />
          </span>
          <strong>{t("modal.addToBundle.createNew")}</strong>
        </button>
        {filtered.map((b) => (
          <div key={b.id} className="vault-list-row">
            <span
              className="vault-avatar"
              style={{ width: 44, height: 44, borderRadius: 10, background: "var(--surface-2)" }}
            >
              <Icon name="layers" size={18} />
            </span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600 }}>{b.title}</div>
              <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                {t("bundle.assetsCount", { count: b.assetCount })}
              </div>
            </span>
            <button
              className="vault-icon-btn"
              aria-label={`Add to ${b.title}`}
              disabled={busyId !== null}
              onClick={() => addToBundle(b.id)}
            >
              <Icon name="plus" size={16} />
            </button>
          </div>
        ))}
      </Modal>
      {creating && (
        <CreateBundleModal
          onClose={() => setCreating(false)}
          onCreated={(b) => addToBundle(b.id)}
        />
      )}
    </>
  );
}

/**
 * Share modal. People-sharing + per-asset link access are not yet supported by
 * the backend (ASS-50); for bundles a real share link is created. This renders
 * the design and wires the copy-link affordance from a provided link.
 */
export function ShareModal({
  title,
  tenantName,
  shareLink,
  onClose,
}: {
  title: string;
  tenantName: string;
  shareLink: string | null;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [invite, setInvite] = useState("");
  const [copied, setCopied] = useState(false);

  return (
    <Modal
      title={title}
      width={520}
      onClose={onClose}
      footer={
        <button className="vault-btn brand" onClick={onClose}>
          {t("common.done")}
        </button>
      }
    >
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <input
          className="vault-input"
          placeholder={t("modal.share.invitePlaceholder")}
          value={invite}
          onChange={(e) => setInvite(e.target.value)}
        />
        {/* TODO(ASS-50): wire per-asset people invitations. */}
        <button className="vault-btn brand" disabled title="Coming soon">
          {t("modal.share.invite")}
        </button>
      </div>
      <div className="vault-list-row">
        <span className="vault-avatar" style={{ width: 30, height: 30, background: "var(--surface-2)" }}>
          <Icon name="globe" size={16} />
        </span>
        <span style={{ flex: 1 }}>
          <div style={{ fontWeight: 600 }}>{t("modal.share.anyoneWithLink")}</div>
          <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{t("modal.share.inWorkspace", { tenant: tenantName })}</div>
        </span>
      </div>
      <div className="vault-divider" />
      <div style={{ display: "flex", gap: 8 }}>
        <input className="vault-input" readOnly value={shareLink ?? t("modal.share.noLink")} />
        <button
          className="vault-btn brand"
          disabled={!shareLink}
          onClick={() => {
            if (shareLink) {
              void navigator.clipboard?.writeText(shareLink);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }
          }}
        >
          <Icon name="copy" size={16} />
          {copied ? t("modal.share.copied") : t("modal.share.copyLink")}
        </button>
      </div>
    </Modal>
  );
}
