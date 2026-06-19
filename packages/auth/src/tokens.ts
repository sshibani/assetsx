import { randomUUID } from "node:crypto";
import jwt, { type SignOptions } from "jsonwebtoken";
import type {
  AccountRole,
  GlobalRole,
  Permission,
} from "@assetx/shared-types";

export interface TokenClaims {
  sub: string;
  globalRole: GlobalRole;
  accountId: string | null;
  accountRole: AccountRole | null;
  permissions: Permission[];
  identityProvider: string;
  sessionId?: string;
  authTime?: number;
}

export interface DecodedToken extends TokenClaims {
  iat: number;
  exp: number;
  jti: string;
  type: "access" | "refresh";
}

export interface TokenServiceOptions {
  accessSecret: string;
  refreshSecret: string;
  accessTtl: SignOptions["expiresIn"];
  refreshTtl: SignOptions["expiresIn"];
  issuer?: string;
  audience?: string;
}

export class TokenService {
  constructor(private readonly options: TokenServiceOptions) {}

  signAccessToken(claims: TokenClaims): string {
    return jwt.sign({ ...claims, type: "access" }, this.options.accessSecret, {
      expiresIn: this.options.accessTtl,
      jwtid: randomUUID(),
      issuer: this.options.issuer,
      audience: this.options.audience,
    });
  }

  signRefreshToken(claims: TokenClaims): string {
    return jwt.sign({ ...claims, type: "refresh" }, this.options.refreshSecret, {
      expiresIn: this.options.refreshTtl,
      jwtid: randomUUID(),
      issuer: this.options.issuer,
      audience: this.options.audience,
    });
  }

  verifyAccessToken(token: string): DecodedToken {
    const decoded = jwt.verify(token, this.options.accessSecret, {
      issuer: this.options.issuer,
      audience: this.options.audience,
    }) as DecodedToken;
    if (decoded.type !== "access") {
      throw new Error("Expected an access token");
    }
    return decoded;
  }

  verifyRefreshToken(token: string): DecodedToken {
    const decoded = jwt.verify(token, this.options.refreshSecret, {
      issuer: this.options.issuer,
      audience: this.options.audience,
    }) as DecodedToken;
    if (decoded.type !== "refresh") {
      throw new Error("Expected a refresh token");
    }
    return decoded;
  }
}
