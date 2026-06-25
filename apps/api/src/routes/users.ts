import type { FastifyInstance, FastifyReply } from "fastify";
import { z } from "zod";
import { LOCALES } from "@assetx/shared-types";
import { makeAuthGuard } from "../auth-guard.js";
import type { AppDependencies } from "../dependencies.js";
import { UserService } from "../services/user-service.js";
import { AssetError } from "../services/asset-service.js";

const updateMeSchema = z.object({
  locale: z.enum(LOCALES),
});

const passwordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8).max(200),
});

function handleError(reply: FastifyReply, err: unknown) {
  if (err instanceof AssetError) {
    return reply.code(err.statusCode).send({ error: err.message });
  }
  throw err;
}

export async function registerUserRoutes(
  app: FastifyInstance,
  deps: AppDependencies,
): Promise<void> {
  const service = new UserService(deps.prisma, deps.storage);
  const authGuard = makeAuthGuard(deps.tokens, deps.prisma);

  app.get("/api/users/me", { preHandler: authGuard }, async (request, reply) => {
    try {
      return reply.send(await service.getMe(request.user!));
    } catch (err) {
      return handleError(reply, err);
    }
  });

  app.patch("/api/users/me", { preHandler: authGuard }, async (request, reply) => {
    const parsed = updateMeSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.flatten() });
    }
    try {
      return reply.send(
        await service.updateLocale(request.user!, parsed.data.locale),
      );
    } catch (err) {
      return handleError(reply, err);
    }
  });

  app.post(
    "/api/users/me/avatar",
    { preHandler: authGuard },
    async (request, reply) => {
      const file = await request.file();
      if (!file) return reply.code(400).send({ error: "No file uploaded" });
      const buffer = await file.toBuffer();
      try {
        return reply.send(await service.uploadAvatar(request.user!, { buffer }));
      } catch (err) {
        return handleError(reply, err);
      }
    },
  );

  app.delete(
    "/api/users/me/avatar",
    { preHandler: authGuard },
    async (request, reply) => {
      try {
        return reply.send(await service.removeAvatar(request.user!));
      } catch (err) {
        return handleError(reply, err);
      }
    },
  );

  app.post(
    "/api/users/me/password",
    { preHandler: authGuard },
    async (request, reply) => {
      const parsed = passwordSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: parsed.error.flatten() });
      }
      try {
        await service.changePassword(request.user!, parsed.data);
        return reply.code(204).send();
      } catch (err) {
        return handleError(reply, err);
      }
    },
  );
}
