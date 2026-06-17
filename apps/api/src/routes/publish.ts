import type { FastifyInstance, FastifyReply } from "fastify";
import { z } from "zod";
import { PublishService } from "../services/publish-service.js";
import { AssetError } from "../services/asset-service.js";
import { makeAuthGuard } from "../auth-guard.js";
import type { AppDependencies } from "../dependencies.js";

const publishSchema = z.object({
  channelIds: z.array(z.string().min(1)).min(1),
});

function handleError(reply: FastifyReply, err: unknown) {
  if (err instanceof AssetError) {
    return reply.code(err.statusCode).send({ error: err.message });
  }
  if (err instanceof Error && err.message.startsWith("Unknown channel")) {
    return reply.code(400).send({ error: err.message });
  }
  throw err;
}

export async function registerPublishRoutes(
  app: FastifyInstance,
  deps: AppDependencies,
): Promise<void> {
  const service = new PublishService(deps.prisma, deps.queue, deps.channels);
  const authGuard = makeAuthGuard(deps.tokens);

  app.get("/api/channels", { preHandler: authGuard }, async (_request, reply) => {
    return reply.send({ items: service.listChannels() });
  });

  app.post(
    "/api/assets/:id/publish",
    { preHandler: authGuard },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const parsed = publishSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: parsed.error.flatten() });
      }
      try {
        await service.publish(id, request.user!, parsed.data.channelIds);
        return reply.code(202).send({ status: "queued" });
      } catch (err) {
        return handleError(reply, err);
      }
    },
  );

  app.get(
    "/api/assets/:id/publications",
    { preHandler: authGuard },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      try {
        return reply.send({
          items: await service.listPublications(id, request.user!),
        });
      } catch (err) {
        return handleError(reply, err);
      }
    },
  );

  app.delete(
    "/api/publications/:id",
    { preHandler: authGuard },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      try {
        await service.unpublish(id, request.user!);
        return reply.code(204).send();
      } catch (err) {
        return handleError(reply, err);
      }
    },
  );
}
