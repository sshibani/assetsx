"use client";

import { useState } from "react";
import { useTranslation } from "../../lib/i18n";

/**
 * Editable tag list. Calls onChange with the full next tag set; the parent
 * persists via PATCH /api/assets/:id { tags }. Normalization (trim/lowercase/
 * dedupe/sort) is also applied server-side, so this is best-effort UX.
 */
export function TagEditor({
  tags,
  disabled,
  onChange,
}: {
  tags: string[];
  disabled?: boolean;
  onChange: (next: string[]) => void;
}) {
  const { t } = useTranslation();
  const [input, setInput] = useState("");

  const add = () => {
    const tag = input.trim().toLowerCase();
    if (!tag) return;
    if (!tags.includes(tag)) onChange([...tags, tag]);
    setInput("");
  };

  const remove = (tag: string) => onChange(tags.filter((t) => t !== tag));

  return (
    <div>
      {tags.length > 0 ? (
        <div className="vault-tag-row" style={{ marginBottom: 10 }}>
          {tags.map((tag) => (
            <span
              key={tag}
              className="vault-tag"
              style={{ background: "var(--brand-tint)", color: "var(--brand)" }}
            >
              {tag}
              {!disabled && (
                <button
                  type="button"
                  style={{ marginLeft: 6, border: "none", background: "none", cursor: "pointer", color: "inherit" }}
                  aria-label={t("tags.remove", { tag })}
                  onClick={() => remove(tag)}
                >
                  ×
                </button>
              )}
            </span>
          ))}
        </div>
      ) : (
        <p style={{ color: "var(--text-muted)", margin: "0 0 10px", fontSize: 13 }}>
          {t("tags.none")}
        </p>
      )}
      {!disabled && (
        <input
          className="vault-input"
          placeholder={t("tags.placeholder")}
          value={input}
          maxLength={64}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          onBlur={add}
        />
      )}
    </div>
  );
}
