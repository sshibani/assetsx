import type { FastifyInstance, FastifyReply } from "fastify";
import { z } from "zod";
import { BundleService, BundleError } from "../services/bundle-service.js";
import { makeAuthGuard } from "../auth-guard.js";
import type { AppDependencies } from "../dependencies.js";

const createSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().max(5000).nullable().optional(),
});

const updateSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  description: z.string().max(5000).nullable().optional(),
});

const addAssetSchema = z.object({
  assetId: z.string().min(1),
  position: z.number().int().min(0).optional(),
});

const createShareSchema = z.object({
  expiresInDays: z.number().int().min(1).max(365).optional(),
});

function handleError(reply: FastifyReply, err: unknown) {
  if (err instanceof BundleError) {
    return reply.code(err.statusCode).send({ error: err.message });
  }
  throw err;
}

export async function registerBundleRoutes(
  app: FastifyInstance,
  deps: AppDependencies,
): Promise<void> {
  const shareBaseUrl = process.env.APP_BASE_URL ?? "http://localhost:3000";
  const service = new BundleService(deps.prisma, deps.storage, shareBaseUrl);
  const authGuard = makeAuthGuard(deps.tokens, deps.prisma);

  app.get("/api/bundles", { preHandler: authGuard }, async (request, reply) => {
    try {
      const items = await service.list(request.user!);
      return reply.send({ items });
    } catch (err) {
      return handleError(reply, err);
    }
  });

  app.post("/api/bundles", { preHandler: authGuard }, async (request, reply) => {
    const parsed = createSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.flatten() });
    }
    try {
      const bundle = await service.create(request.user!, parsed.data);
      return reply.code(201).send(bundle);
    } catch (err) {
      return handleError(reply, err);
    }
  });

  app.get(
    "/api/bundles/:id",
    { preHandler: authGuard },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      try {
        return reply.send(await service.getDetail(id, request.user!));
      } catch (err) {
        return handleError(reply, err);
      }
    },
  );

  app.patch(
    "/api/bundles/:id",
    { preHandler: authGuard },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const parsed = updateSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: parsed.error.flatten() });
      }
      try {
        return reply.send(
          await service.update(id, request.user!, parsed.data),
        );
      } catch (err) {
        return handleError(reply, err);
      }
    },
  );

  app.delete(
    "/api/bundles/:id",
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

  app.post(
    "/api/bundles/:id/assets",
    { preHandler: authGuard },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const parsed = addAssetSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: parsed.error.flatten() });
      }
      try {
        const bundle = await service.addAsset(id, request.user!, parsed.data);
        return reply.code(201).send(bundle);
      } catch (err) {
        return handleError(reply, err);
      }
    },
  );

  app.delete(
    "/api/bundles/:id/assets/:assetId",
    { preHandler: authGuard },
    async (request, reply) => {
      const { id, assetId } = request.params as {
        id: string;
        assetId: string;
      };
      try {
        await service.removeAsset(id, request.user!, assetId);
        return reply.code(204).send();
      } catch (err) {
        return handleError(reply, err);
      }
    },
  );

  // --- Sharing (Phase 2) ---
  app.post(
    "/api/bundles/:id/share",
    { preHandler: authGuard },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const parsed = createShareSchema.safeParse(request.body ?? {});
      if (!parsed.success) {
        return reply.code(400).send({ error: parsed.error.flatten() });
      }
      try {
        const share = await service.createShare(id, request.user!, parsed.data);
        return reply.code(201).send(share);
      } catch (err) {
        return handleError(reply, err);
      }
    },
  );

  app.delete(
    "/api/bundles/:id/share/:shareId",
    { preHandler: authGuard },
    async (request, reply) => {
      const { id, shareId } = request.params as {
        id: string;
        shareId: string;
      };
      try {
        await service.revokeShare(id, request.user!, shareId);
        return reply.code(204).send();
      } catch (err) {
        return handleError(reply, err);
      }
    },
  );

  // Public, unauthenticated read access by share token (no authGuard).
  app.get("/api/shared/bundles/:token", async (request, reply) => {
    const { token } = request.params as { token: string };
    try {
      return reply.send(await service.getPublicByToken(token));
    } catch (err) {
      return handleError(reply, err);
    }
  });
}
