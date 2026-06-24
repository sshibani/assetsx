import type { FastifyInstance, FastifyReply } from "fastify";
import { z } from "zod";
import { ACCOUNT_ROLES, DATE_TIME_FORMATS } from "@assetx/shared-types";
import { makeAuthGuard } from "../auth-guard.js";
import type { AppDependencies } from "../dependencies.js";
import { AccountService } from "../services/account-service.js";
import { AssetError } from "../services/asset-service.js";

const accountCreateSchema = z.object({
  name: z.string().min(1).max(120),
  slug: z.string().min(1).max(80).regex(/^[a-z0-9-]+$/),
});

const accountUpdateSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  slug: z.string().min(1).max(80).regex(/^[a-z0-9-]+$/).optional(),
  status: z.enum(["active", "disabled"]).optional(),
});

const memberCreateSchema = z.object({
  email: z.string().email(),
  role: z.enum(ACCOUNT_ROLES),
});

const memberUpdateSchema = z.object({
  role: z.enum(ACCOUNT_ROLES).optional(),
  status: z.enum(["active", "disabled"]).optional(),
});

const settingsUpdateSchema = z
  .object({
    dateTimeFormat: z.enum(DATE_TIME_FORMATS).optional(),
    timezone: z.string().min(1).max(64).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field is required",
  });

const adminListQuerySchema = z.object({
  q: z.string().min(1).max(120).optional(),
});

function handleError(reply: FastifyReply, err: unknown) {
  if (err instanceof AssetError) {
    return reply.code(err.statusCode).send({ error: err.message });
  }
  throw err;
}

export async function registerAccountRoutes(
  app: FastifyInstance,
  deps: AppDependencies,
): Promise<void> {
  const service = new AccountService(deps.prisma);
  const authGuard = makeAuthGuard(deps.tokens, deps.prisma);

  app.get("/api/accounts", { preHandler: authGuard }, async (request) => {
    return { items: await service.list(request.user!) };
  });

  app.get(
    "/api/admin/accounts",
    { preHandler: authGuard },
    async (request, reply) => {
      const parsed = adminListQuerySchema.safeParse(request.query);
      if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
      try {
        return reply.send({
          items: await service.adminList(request.user!, parsed.data),
        });
      } catch (err) {
        return handleError(reply, err);
      }
    },
  );

  app.post("/api/accounts", { preHandler: authGuard }, async (request, reply) => {
    const parsed = accountCreateSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    try {
      return reply.code(201).send(await service.create(request.user!, parsed.data));
    } catch (err) {
      return handleError(reply, err);
    }
  });

  app.get(
    "/api/accounts/:accountId",
    { preHandler: authGuard },
    async (request, reply) => {
      const { accountId } = request.params as { accountId: string };
      try {
        return reply.send(await service.get(accountId, request.user!));
      } catch (err) {
        return handleError(reply, err);
      }
    },
  );

  app.patch(
    "/api/accounts/:accountId",
    { preHandler: authGuard },
    async (request, reply) => {
      const { accountId } = request.params as { accountId: string };
      const parsed = accountUpdateSchema.safeParse(request.body);
      if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
      try {
        return reply.send(await service.update(accountId, request.user!, parsed.data));
      } catch (err) {
        return handleError(reply, err);
      }
    },
  );

  app.get(
    "/api/accounts/:accountId/members",
    { preHandler: authGuard },
    async (request, reply) => {
      const { accountId } = request.params as { accountId: string };
      try {
        return reply.send({ items: await service.listMembers(accountId, request.user!) });
      } catch (err) {
        return handleError(reply, err);
      }
    },
  );

  app.post(
    "/api/accounts/:accountId/members",
    { preHandler: authGuard },
    async (request, reply) => {
      const { accountId } = request.params as { accountId: string };
      const parsed = memberCreateSchema.safeParse(request.body);
      if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
      try {
        return reply
          .code(201)
          .send(await service.addMember(accountId, request.user!, parsed.data));
      } catch (err) {
        return handleError(reply, err);
      }
    },
  );

  app.patch(
    "/api/accounts/:accountId/members/:membershipId",
    { preHandler: authGuard },
    async (request, reply) => {
      const { accountId, membershipId } = request.params as {
        accountId: string;
        membershipId: string;
      };
      const parsed = memberUpdateSchema.safeParse(request.body);
      if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
      try {
        return reply.send(
          await service.updateMember(
            accountId,
            membershipId,
            request.user!,
            parsed.data,
          ),
        );
      } catch (err) {
        return handleError(reply, err);
      }
    },
  );

  app.delete(
    "/api/accounts/:accountId/members/:membershipId",
    { preHandler: authGuard },
    async (request, reply) => {
      const { accountId, membershipId } = request.params as {
        accountId: string;
        membershipId: string;
      };
      try {
        await service.deleteMember(accountId, membershipId, request.user!);
        return reply.code(204).send();
      } catch (err) {
        return handleError(reply, err);
      }
    },
  );

  app.get(
    "/api/accounts/:accountId/settings",
    { preHandler: authGuard },
    async (request, reply) => {
      const { accountId } = request.params as { accountId: string };
      try {
        return reply.send(await service.getSettings(accountId, request.user!));
      } catch (err) {
        return handleError(reply, err);
      }
    },
  );

  app.put(
    "/api/accounts/:accountId/settings",
    { preHandler: authGuard },
    async (request, reply) => {
      const { accountId } = request.params as { accountId: string };
      const parsed = settingsUpdateSchema.safeParse(request.body);
      if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
      try {
        return reply.send(
          await service.updateSettings(accountId, request.user!, parsed.data),
        );
      } catch (err) {
        return handleError(reply, err);
      }
    },
  );
}
