import { loadConfig } from "./config.js";
import { buildDependencies } from "./build-dependencies.js";
import { buildApp } from "./app.js";

async function main(): Promise<void> {
  const config = loadConfig();
  const deps = buildDependencies(config);
  const app = await buildApp(deps, { maxUploadBytes: config.maxUploadBytes });

  await app.listen({ port: config.port, host: "0.0.0.0" });
  // eslint-disable-next-line no-console
  console.log(`AssetX API listening on :${config.port}`);

  const shutdown = async () => {
    await app.close();
    await deps.queue.close();
    await deps.prisma.$disconnect();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
