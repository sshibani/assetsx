import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { AuthService, AuthError } from "../services/auth-service.js";
import { makeAuthGuard } from "../auth-guard.js";
import type { AppDependencies } from "../dependencies.js";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

const signupSchema = z.object({
  accountName: z.string().min(1).max(100),
  email: z.string().email(),
  password: z.string().min(8),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

const switchAccountSchema = z.object({
  accountId: z.string().uuid(),
});

export async function registerAuthRoutes(
  app: FastifyInstance,
  deps: AppDependencies,
): Promise<void> {
  const service = new AuthService(deps.prisma, deps.tokens, deps.storage);
  const authGuard = makeAuthGuard(deps.tokens, deps.prisma);

  app.post("/api/auth/register", async (request, reply) => {
    const parsed = credentialsSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.flatten() });
    }
    try {
      const user = await service.register(
        parsed.data.email,
        parsed.data.password,
      );
      return reply.code(201).send(user);
    } catch (err) {
      if (err instanceof AuthError) {
        return reply.code(err.statusCode).send({ error: err.message });
      }
      throw err;
    }
  });

  app.post("/api/auth/signup", async (request, reply) => {
    const parsed = signupSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.flatten() });
    }
    try {
      const tokens = await service.signup(
        parsed.data.accountName,
        parsed.data.email,
        parsed.data.password,
      );
      return reply.code(201).send(tokens);
    } catch (err) {
      if (err instanceof AuthError) {
        return reply.code(err.statusCode).send({ error: err.message });
      }
      throw err;
    }
  });

  app.post("/api/auth/login", async (request, reply) => {
    const parsed = credentialsSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.flatten() });
    }
    try {
      const tokens = await service.login(parsed.data.email, parsed.data.password);
      return reply.send(tokens);
    } catch (err) {
      if (err instanceof AuthError) {
        return reply.code(err.statusCode).send({ error: err.message });
      }
      throw err;
    }
  });

  app.post("/api/auth/refresh", async (request, reply) => {
    const parsed = refreshSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.flatten() });
    }
    try {
      const tokens = await service.refresh(parsed.data.refreshToken);
      return reply.send(tokens);
    } catch (err) {
      if (err instanceof AuthError) {
        return reply.code(err.statusCode).send({ error: err.message });
      }
      throw err;
    }
  });

  app.post(
    "/api/auth/switch-account",
    { preHandler: authGuard },
    async (request, reply) => {
      const parsed = switchAccountSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: parsed.error.flatten() });
      }
      try {
        return reply.send(
          await service.switchAccount(request.user!.id, parsed.data.accountId),
        );
      } catch (err) {
        if (err instanceof AuthError) {
          return reply.code(err.statusCode).send({ error: err.message });
        }
        throw err;
      }
    },
  );

  app.post(
    "/api/auth/logout",
    { preHandler: authGuard },
    async (request, reply) => {
      const parsed = refreshSchema.safeParse(request.body);
      if (parsed.success) {
        await service.logout(parsed.data.refreshToken);
      }
      return reply.code(204).send();
    },
  );

  app.get("/api/auth/me", { preHandler: authGuard }, async (request, reply) => {
    const user = await deps.prisma.user.findUnique({
      where: { id: request.user!.id },
    });
    if (!user) {
      return reply.code(404).send({ error: "User not found" });
    }
    return reply.send({
      id: user.id,
      email: user.email,
      globalRole: user.globalRole,
      locale: user.locale,
      avatarUrl: user.avatarStorageKey
        ? deps.storage.getUrl(user.avatarStorageKey)
        : null,
      createdAt: user.createdAt.toISOString(),
      activeAccount: request.user!.accountId,
      accounts: await service.accountContextsForUser(user.id),
    });
  });
}
