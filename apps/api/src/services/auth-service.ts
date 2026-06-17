import { createHash, randomUUID } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import { hashPassword, verifyPassword, type TokenService } from "@assetx/auth";
import type { AuthTokens, UserRole } from "@assetx/shared-types";

export class AuthError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
  }
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export class AuthService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly tokens: TokenService,
  ) {}

  async register(
    email: string,
    password: string,
    role: UserRole = "user",
  ): Promise<{ id: string; email: string; role: UserRole }> {
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new AuthError("Email already registered", 409);
    }
    const user = await this.prisma.user.create({
      data: { email, passwordHash: await hashPassword(password), role },
    });
    return { id: user.id, email: user.email, role: user.role as UserRole };
  }

  async login(email: string, password: string): Promise<AuthTokens> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || !(await verifyPassword(user.passwordHash, password))) {
      throw new AuthError("Invalid credentials", 401);
    }
    return this.issueTokens(user.id, user.role as UserRole);
  }

  async refresh(refreshToken: string): Promise<AuthTokens> {
    let claims;
    try {
      claims = this.tokens.verifyRefreshToken(refreshToken);
    } catch {
      throw new AuthError("Invalid refresh token", 401);
    }

    const tokenHash = sha256(refreshToken);
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
    });
    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      throw new AuthError("Refresh token is no longer valid", 401);
    }

    // Rotate: revoke the used token, then issue a fresh pair.
    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    return this.issueTokens(claims.sub, claims.role);
  }

  async logout(refreshToken: string): Promise<void> {
    const tokenHash = sha256(refreshToken);
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private async issueTokens(
    userId: string,
    role: UserRole,
  ): Promise<AuthTokens> {
    const accessToken = this.tokens.signAccessToken({ sub: userId, role });
    const refreshToken = this.tokens.signRefreshToken({ sub: userId, role });

    await this.prisma.refreshToken.create({
      data: {
        id: randomUUID(),
        userId,
        tokenHash: sha256(refreshToken),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    return { accessToken, refreshToken };
  }
}
