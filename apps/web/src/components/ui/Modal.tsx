"use client";

import { useEffect, type ReactNode } from "react";
import { Icon } from "./Icon";
import { useTranslation } from "../../lib/i18n";

export function Modal({
  title,
  onClose,
  width = 500,
  children,
  footer,
}: {
  title: string;
  onClose: () => void;
  width?: number;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const { t } = useTranslation();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="vault-scrim" role="dialog" aria-modal="true" aria-label={title} onClick={onClose}>
      <div
        className="vault-modal"
        style={{ width }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="vault-modal-header">
          <h2 className="vault-modal-title">{title}</h2>
          <button
            type="button"
            className="vault-icon-btn"
            aria-label={t("common.close")}
            onClick={onClose}
          >
            <Icon name="x" size={18} />
          </button>
        </div>
        <div className="vault-modal-body">{children}</div>
        {footer && <div className="vault-modal-footer">{footer}</div>}
      </div>
    </div>
  );
}
