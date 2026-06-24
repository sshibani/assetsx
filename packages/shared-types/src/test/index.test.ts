import { describe, it, expect } from "vitest";
import {
  ACCOUNT_ROLES,
  PERMISSIONS,
  permissionsForAccountRole,
  ASSET_STATUSES,
  RENDITION_NAMES,
  SUPPORTED_MIME_TYPES,
  USER_ROLES,
} from "../index.js";

describe("shared-types constants", () => {
  it("exposes the four asset statuses in order", () => {
    expect(ASSET_STATUSES).toEqual(["pending", "processing", "ready", "failed"]);
  });

  it("exposes the rendition names", () => {
    expect(RENDITION_NAMES).toEqual(["thumb", "standard", "large", "original"]);
  });

  it("supports the expected asset mime types", () => {
    expect(SUPPORTED_MIME_TYPES).toContain("image/jpeg");
    expect(SUPPORTED_MIME_TYPES).toContain("image/webp");
    expect(SUPPORTED_MIME_TYPES).toContain("application/pdf");
  });

  it("defines super user and normal user roles", () => {
    expect(USER_ROLES).toEqual(["super_user", "user"]);
  });

  it("defines exactly the three account roles", () => {
    expect(ACCOUNT_ROLES).toEqual([
      "account_owner",
      "account_editor",
      "account_viewer",
    ]);
  });

  it("defines account roles and permissions", () => {
    expect(PERMISSIONS).toContain("assets:publish");
    expect(permissionsForAccountRole("account_viewer")).toEqual([
      "account:read",
      "assets:read",
      "comments:read",
    ]);
    expect(permissionsForAccountRole("account_owner")).toContain(
      "members:manage",
    );
  });

  it("defines owner-only permissions", () => {
    expect(PERMISSIONS).toContain("account:delete");
    expect(PERMISSIONS).toContain("members:manage_admins");
  });

  it("grants member & account management to account_owner only", () => {
    const owner = permissionsForAccountRole("account_owner");
    expect(owner).toContain("account:delete");
    expect(owner).toContain("members:manage_admins");
    expect(owner).toContain("members:manage");
    expect(owner).toContain("account:update");

    const editor = permissionsForAccountRole("account_editor");
    expect(editor).not.toContain("account:delete");
    expect(editor).not.toContain("members:manage_admins");
    expect(editor).not.toContain("members:manage");
    expect(editor).not.toContain("account:update");
  });

  it("lets account_editor manage assets", () => {
    const editor = permissionsForAccountRole("account_editor");
    expect(editor).toContain("assets:create");
    expect(editor).toContain("assets:update");
    expect(editor).toContain("assets:delete");
    expect(editor).toContain("assets:publish");
    expect(editor).toContain("comments:create");
  });

  it("differentiates the three roles", () => {
    const owner = permissionsForAccountRole("account_owner");
    const editor = permissionsForAccountRole("account_editor");
    const viewer = permissionsForAccountRole("account_viewer");
    expect(owner).not.toEqual(editor);
    expect(editor).not.toEqual(viewer);
  });
});
