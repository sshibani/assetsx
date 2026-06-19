import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export interface AppConfig {
  port: number;
  nodeEnv: string;
  jwt: {
    accessSecret: string;
    refreshSecret: string;
    accessTtl: string;
    refreshTtl: string;
    issuer: string;
    audience: string;
  };
  storage: {
    root: string;
    publicBaseUrl: string;
  };
  redis: {
    host: string;
    port: number;
  };
  maxUploadBytes: number;
}

const workspaceRoot = fileURLToPath(new URL("../../..", import.meta.url));

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

function resolveFromWorkspaceRoot(path: string): string {
  return resolve(workspaceRoot, path);
}

export function loadConfig(): AppConfig {
  const storageRoot = process.env.STORAGE_ROOT ?? "./storage-data";
  return {
    port: Number(process.env.PORT ?? 3001),
    nodeEnv: process.env.NODE_ENV ?? "development",
    jwt: {
      accessSecret: required("JWT_ACCESS_SECRET", "dev-access-secret"),
      refreshSecret: required("JWT_REFRESH_SECRET", "dev-refresh-secret"),
      accessTtl: process.env.JWT_ACCESS_TTL ?? "15m",
      refreshTtl: process.env.JWT_REFRESH_TTL ?? "7d",
      issuer: process.env.JWT_ISSUER ?? "assetx",
      audience: process.env.JWT_AUDIENCE ?? "assetx-api",
    },
    storage: {
      root: resolveFromWorkspaceRoot(storageRoot),
      publicBaseUrl: process.env.PUBLIC_BASE_URL ?? "http://localhost:3001/files",
    },
    redis: {
      host: process.env.REDIS_HOST ?? "localhost",
      port: Number(process.env.REDIS_PORT ?? 6379),
    },
    maxUploadBytes: Number(process.env.MAX_UPLOAD_BYTES ?? 25 * 1024 * 1024),
  };
}
