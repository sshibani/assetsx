import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { AuthService, AuthError } from "../services/auth-service.js";
import { makeAuthGuard } from "../auth-guard.js";
import type { AppDependencies } from "../dependencies.js";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

export async function registerAuthRoutes(
  app: FastifyInstance,
  deps: AppDependencies,
): Promise<void> {
  const service = new AuthService(deps.prisma, deps.tokens);
  const authGuard = makeAuthGuard(deps.tokens);

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
      role: user.role,
      createdAt: user.createdAt.toISOString(),
    });
  });
}
