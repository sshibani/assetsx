import { describe, it, expect } from "vitest";
import {
  ACCOUNT_ROLES,
  PERMISSIONS,
  permissionsForAccountRole,
  ASSET_STATUSES,
  RENDITION_NAMES,
  SUPPORTED_MIME_TYPES,
  USER_ROLES,
} from "./index.js";

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

  it("defines account roles and permissions", () => {
    expect(ACCOUNT_ROLES).toContain("account_owner");
    expect(ACCOUNT_ROLES).toContain("asset_viewer");
    expect(PERMISSIONS).toContain("assets:publish");
    expect(permissionsForAccountRole("asset_viewer")).toEqual([
      "account:read",
      "assets:read",
    ]);
    expect(permissionsForAccountRole("account_owner")).toContain(
      "members:manage",
    );
  });
});
