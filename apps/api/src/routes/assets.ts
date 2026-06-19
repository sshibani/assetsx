import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { AssetService, AssetError } from "../services/asset-service.js";
import { makeAuthGuard } from "../auth-guard.js";
import type { AppDependencies } from "../dependencies.js";
import { hasPermission } from "../authorization.js";

const updateSchema = z.object({
  title: z.string().max(255).nullable().optional(),
  description: z.string().max(5000).nullable().optional(),
  expiresAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
});

function handleError(reply: import("fastify").FastifyReply, err: unknown) {
  if (err instanceof AssetError) {
    return reply.code(err.statusCode).send({ error: err.message });
  }
  throw err;
}

export async function registerAssetRoutes(
  app: FastifyInstance,
  deps: AppDependencies,
): Promise<void> {
  const service = new AssetService(deps.prisma, deps.storage, deps.queue);
  const authGuard = makeAuthGuard(deps.tokens, deps.prisma);

  app.post("/api/assets", { preHandler: authGuard }, async (request, reply) => {
    const file = await request.file();
    if (!file) {
      return reply.code(400).send({ error: "No file uploaded" });
    }
    const buffer = await file.toBuffer();
    try {
      if (!request.user!.accountId || !hasPermission(request.user!, "assets:create")) {
        return reply.code(403).send({ error: "Forbidden" });
      }
      const asset = await service.upload({
        accountId: request.user!.accountId,
        ownerId: request.user!.id,
        originalName: file.filename,
        buffer,
      });
      return reply.code(201).send(asset);
    } catch (err) {
      return handleError(reply, err);
    }
  });

  app.get("/api/assets", { preHandler: authGuard }, async (request, reply) => {
    const items = await service.list(request.user!);
    return reply.send({ items });
  });

  app.get(
    "/api/assets/:id",
    { preHandler: authGuard },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      try {
        return reply.send(await service.getForUser(id, request.user!));
      } catch (err) {
        return handleError(reply, err);
      }
    },
  );

  app.patch(
    "/api/assets/:id",
    { preHandler: authGuard },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const parsed = updateSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: parsed.error.flatten() });
      }
      try {
        return reply.send(
          await service.updateMetadata(id, request.user!, parsed.data),
        );
      } catch (err) {
        return handleError(reply, err);
      }
    },
  );

  app.delete(
    "/api/assets/:id",
    { preHandler: authGuard },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      try {
        await service.delete(id, request.user!);
        return reply.code(204).send();
      } catch (err) {
        return handleError(reply, err);
      }
    },
  );
}
