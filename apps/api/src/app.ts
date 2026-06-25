import { isAbsolute, resolve } from "node:path";
import Fastify, { type FastifyInstance } from "fastify";
import multipart from "@fastify/multipart";
import fastifyStatic from "@fastify/static";
import { registerAuthRoutes } from "./routes/auth.js";
import { registerAccountRoutes } from "./routes/accounts.js";
import { registerAdminUserRoutes } from "./routes/admin-users.js";
import { registerUserRoutes } from "./routes/users.js";
import { registerAssetRoutes } from "./routes/assets.js";
import { registerBundleRoutes } from "./routes/bundles.js";
import { registerPublishRoutes } from "./routes/publish.js";
import type { AppDependencies } from "./dependencies.js";

export interface BuildAppOptions {
  maxUploadBytes?: number;
  /** When set, serves stored files (renditions/originals) at /files/*. */
  staticRoot?: string;
}

export async function buildApp(
  deps: AppDependencies,
  options: BuildAppOptions = {},
): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });

  await app.register(multipart, {
    limits: { fileSize: options.maxUploadBytes ?? 25 * 1024 * 1024, files: 1 },
  });

  if (options.staticRoot) {
    const root = isAbsolute(options.staticRoot)
      ? options.staticRoot
      : resolve(process.cwd(), options.staticRoot);
    await app.register(fastifyStatic, { root, prefix: "/files/" });
  }

  app.get("/api/health", async () => ({ status: "ok" }));

  await registerAuthRoutes(app, deps);
  await registerAccountRoutes(app, deps);
  await registerAdminUserRoutes(app, deps);
  await registerUserRoutes(app, deps);
  await registerAssetRoutes(app, deps);
  await registerBundleRoutes(app, deps);
  await registerPublishRoutes(app, deps);

  await app.ready();
  return app;
}
