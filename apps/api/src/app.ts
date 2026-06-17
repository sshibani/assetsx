import Fastify, { type FastifyInstance } from "fastify";
import multipart from "@fastify/multipart";
import { registerAuthRoutes } from "./routes/auth.js";
import { registerAssetRoutes } from "./routes/assets.js";
import { registerPublishRoutes } from "./routes/publish.js";
import type { AppDependencies } from "./dependencies.js";

export interface BuildAppOptions {
  maxUploadBytes?: number;
}

export async function buildApp(
  deps: AppDependencies,
  options: BuildAppOptions = {},
): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });

  await app.register(multipart, {
    limits: { fileSize: options.maxUploadBytes ?? 25 * 1024 * 1024, files: 1 },
  });

  app.get("/api/health", async () => ({ status: "ok" }));

  await registerAuthRoutes(app, deps);
  await registerAssetRoutes(app, deps);
  await registerPublishRoutes(app, deps);

  await app.ready();
  return app;
}
