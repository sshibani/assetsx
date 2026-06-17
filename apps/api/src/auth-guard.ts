import type { FastifyReply, FastifyRequest } from "fastify";
import type { TokenService } from "@assetx/auth";
import type { UserRole } from "@assetx/shared-types";

export interface AuthUser {
  id: string;
  role: UserRole;
}

declare module "fastify" {
  interface FastifyRequest {
    user?: AuthUser;
  }
}

/** Extracts and verifies a Bearer access token; 401 on failure. */
export function makeAuthGuard(tokens: TokenService) {
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
      request.user = { id: decoded.sub, role: decoded.role };
    } catch {
      await reply.code(401).send({ error: "Invalid or expired token" });
    }
  };
}
