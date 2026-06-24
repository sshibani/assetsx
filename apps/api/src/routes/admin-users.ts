import type { FastifyInstance, FastifyReply } from "fastify";
import { z } from "zod";
import { GLOBAL_ROLES } from "@assetx/shared-types";
import { makeAuthGuard } from "../auth-guard.js";
import type { AppDependencies } from "../dependencies.js";
import { UserService } from "../services/user-service.js";
import { AssetError } from "../services/asset-service.js";

const listQuerySchema = z.object({
  q: z.string().min(1).max(120).optional(),
});

const userUpdateSchema = z.object({
  globalRole: z.enum(GLOBAL_ROLES),
});

function handleError(reply: FastifyReply, err: unknown) {
  if (err instanceof AssetError) {
    return reply.code(err.statusCode).send({ error: err.message });
  }
  throw err;
}

export async function registerAdminUserRoutes(
  app: FastifyInstance,
  deps: AppDependencies,
): Promise<void> {
  const service = new UserService(deps.prisma);
  const authGuard = makeAuthGuard(deps.tokens, deps.prisma);

  app.get("/api/admin/users", { preHandler: authGuard }, async (request, reply) => {
    const parsed = listQuerySchema.safeParse(request.query);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    try {
      return reply.send({
        items: await service.listUsers(request.user!, parsed.data),
      });
    } catch (err) {
      return handleError(reply, err);
    }
  });

  app.get(
    "/api/admin/users/:userId",
    { preHandler: authGuard },
    async (request, reply) => {
      const { userId } = request.params as { userId: string };
      try {
        return reply.send(await service.getUser(request.user!, userId));
      } catch (err) {
        return handleError(reply, err);
      }
    },
  );

  app.patch(
    "/api/admin/users/:userId",
    { preHandler: authGuard },
    async (request, reply) => {
      const { userId } = request.params as { userId: string };
      const parsed = userUpdateSchema.safeParse(request.body);
      if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
      try {
        return reply.send(
          await service.setGlobalRole(
            request.user!,
            userId,
            parsed.data.globalRole,
          ),
        );
      } catch (err) {
        return handleError(reply, err);
      }
    },
  );
}
