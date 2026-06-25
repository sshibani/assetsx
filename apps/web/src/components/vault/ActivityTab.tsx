"use client";

import { useState } from "react";
import type { AssetTimelineItemDTO } from "../../lib/types";
import { relativeTime } from "../../lib/vault/format";
import { Avatar } from "../ui/Avatar";
import { Icon } from "../ui/Icon";

export function ActivityTab({
  items,
  canComment,
  posting,
  onComment,
}: {
  items: AssetTimelineItemDTO[];
  canComment: boolean;
  posting: boolean;
  onComment: (body: string) => void | Promise<void>;
}) {
  const [draft, setDraft] = useState("");

  const submit = async () => {
    const body = draft.trim();
    if (!body || posting) return;
    await onComment(body);
    setDraft("");
  };

  return (
    <div className="vault-activity">
      <div className="vault-timeline">
        {items.length === 0 ? (
          <p style={{ color: "var(--text-muted)", fontSize: 13 }}>
            No activity yet.
          </p>
        ) : (
          <>
            <div className="vault-timeline-rail" aria-hidden />
            {items.map((item) => {
              if (item.kind === "comment") {
                const c = item.comment;
                return (
                  <div key={`c-${item.id}`} className="vault-timeline-entry">
                    <Avatar seed={c.authorEmail} size={32} />
                    <div className="vault-timeline-body">
                      <div className="vault-timeline-head">
                        <span className="vault-timeline-name">
                          {c.authorEmail.replace(/@.*/, "")}
                        </span>
                        <span className="vault-timeline-time">
                          {relativeTime(item.createdAt)}
                        </span>
                      </div>
                      <div className="vault-bubble">{c.body}</div>
                    </div>
                  </div>
                );
              }
              const a = item.activity;
              const actor = a.actorEmail?.replace(/@.*/, "") ?? "System";
              return (
                <div key={`a-${item.id}`} className="vault-timeline-entry">
                  <Avatar seed={a.actorEmail ?? "system"} size={32} />
                  <div className="vault-timeline-body" style={{ paddingTop: 6 }}>
                    <div className="vault-timeline-event">
                      <span className="vault-timeline-name">{actor}</span>{" "}
                      {a.summary}
                    </div>
                    <div className="vault-timeline-time">
                      {relativeTime(item.createdAt)}
                    </div>
                  </div>
                </div>
              );
            })}
          </>
        )}
      </div>

      {canComment && (
        <div className="vault-composer">
          <Avatar seed="me" size={30} color="#ffcfbd" />
          <div className="vault-composer-shell">
            <textarea
              className="vault-composer-input"
              rows={2}
              placeholder="Add a comment…"
              value={draft}
              maxLength={2000}
              onChange={(e) => setDraft(e.target.value)}
            />
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button
                type="button"
                className={`vault-composer-btn${draft.trim() ? " enabled" : ""}`}
                disabled={!draft.trim() || posting}
                onClick={submit}
              >
                <Icon name="share" size={14} />
                {posting ? "Posting…" : "Comment"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
