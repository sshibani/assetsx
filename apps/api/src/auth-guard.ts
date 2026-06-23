import type { FastifyReply, FastifyRequest } from "fastify";
import type { PrismaClient } from "@prisma/client";
import type { TokenService } from "@assetx/auth";
import type { AccountRole, GlobalRole, Permission } from "@assetx/shared-types";
import { permissionsForAccountRole } from "@assetx/shared-types";
import type { AuthUser } from "./authorization.js";
export type { AuthUser } from "./authorization.js";

declare module "fastify" {
  interface FastifyRequest {
    user?: AuthUser;
  }
}

/** Extracts and verifies a Bearer access token; 401 on failure. */
export function makeAuthGuard(tokens: TokenService, prisma?: PrismaClient) {
  return async function authGuard(
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> {
    const header = request.headers.authorization;
    if (!header || !header.startsWith("Bearer ")) {
      await reply.code(401).send({ error: "Unauthorized" });
      return;
    }
    const token = header.slice("Bearer ".length);
    try {
      const decoded = tokens.verifyAccessToken(token);
      let accountRole = decoded.accountRole as AccountRole | null;
      let permissions = decoded.permissions as Permission[];
      if (prisma) {
        const user = await prisma.user.findUnique({
          where: { id: decoded.sub },
          select: { id: true, globalRole: true },
        });
        if (!user) {
          await reply.code(401).send({ error: "Invalid or expired token" });
          return;
        }
        if (decoded.accountId) {
          const membership = await prisma.accountMembership.findUnique({
            where: {
              accountId_userId: {
                accountId: decoded.accountId,
                userId: decoded.sub,
              },
            },
            include: { account: true },
          });
          if (
            user.globalRole !== "super_user" &&
            (!membership ||
              membership.status !== "active" ||
              membership.account.status !== "active")
          ) {
            await reply.code(401).send({ error: "Invalid or expired token" });
            return;
          }
          accountRole = (membership?.role as AccountRole | undefined) ?? null;
          permissions = accountRole
            ? permissionsForAccountRole(accountRole)
            : user.globalRole === "super_user"
              ? (["platform:manage"] as Permission[])
              : [];
        } else {
          accountRole = null;
          permissions =
            user.globalRole === "super_user"
              ? (["platform:manage"] as Permission[])
              : [];
        }
      }
      request.user = {
        id: decoded.sub,
        globalRole: decoded.globalRole as GlobalRole,
        accountId: decoded.accountId,
        accountRole,
        permissions,
        identityProvider: decoded.identityProvider,
        sessionId: decoded.sessionId,
      };
    } catch {
      await reply.code(401).send({ error: "Invalid or expired token" });
    }
  };
}
