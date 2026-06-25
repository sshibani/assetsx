"use client";

import { avatarColor, initials } from "../../lib/vault/model";

export function Avatar({
  seed,
  label,
  size = 32,
  color,
}: {
  seed: string;
  label?: string;
  size?: number;
  color?: string;
}) {
  const bg = color ?? avatarColor(seed);
  return (
    <span
      className="vault-avatar"
      style={{
        width: size,
        height: size,
        background: bg,
        fontSize: Math.round(size * 0.4),
      }}
      aria-hidden
      title={label ?? seed}
    >
      {initials(label ?? seed)}
    </span>
  );
}
