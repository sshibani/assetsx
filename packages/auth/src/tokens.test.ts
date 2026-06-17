import { describe, it, expect } from "vitest";
import { TokenService } from "./tokens.js";

const service = new TokenService({
  accessSecret: "access-secret-test",
  refreshSecret: "refresh-secret-test",
  accessTtl: "15m",
  refreshTtl: "7d",
});

const claims = { sub: "user-1", role: "admin" as const };

describe("TokenService access tokens", () => {
  it("signs and verifies an access token round-trip", () => {
    const token = service.signAccessToken(claims);
    const decoded = service.verifyAccessToken(token);
    expect(decoded.sub).toBe("user-1");
    expect(decoded.role).toBe("admin");
  });

  it("rejects an access token verified with the refresh path", () => {
    const token = service.signAccessToken(claims);
    expect(() => service.verifyRefreshToken(token)).toThrow();
  });

  it("rejects a tampered/invalid token", () => {
    expect(() => service.verifyAccessToken("not.a.jwt")).toThrow();
  });
});

describe("TokenService refresh tokens", () => {
  it("signs and verifies a refresh token round-trip", () => {
    const token = service.signRefreshToken(claims);
    const decoded = service.verifyRefreshToken(token);
    expect(decoded.sub).toBe("user-1");
  });

  it("does not accept a refresh token on the access path", () => {
    const token = service.signRefreshToken(claims);
    expect(() => service.verifyAccessToken(token)).toThrow();
  });

  it("issues a unique jti per refresh token", () => {
    const a = service.verifyRefreshToken(service.signRefreshToken(claims));
    const b = service.verifyRefreshToken(service.signRefreshToken(claims));
    expect(a.jti).toBeTruthy();
    expect(a.jti).not.toBe(b.jti);
  });
});
