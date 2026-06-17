export interface AppConfig {
  port: number;
  nodeEnv: string;
  jwt: {
    accessSecret: string;
    refreshSecret: string;
    accessTtl: string;
    refreshTtl: string;
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

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

export function loadConfig(): AppConfig {
  return {
    port: Number(process.env.PORT ?? 3001),
    nodeEnv: process.env.NODE_ENV ?? "development",
    jwt: {
      accessSecret: required("JWT_ACCESS_SECRET", "dev-access-secret"),
      refreshSecret: required("JWT_REFRESH_SECRET", "dev-refresh-secret"),
      accessTtl: process.env.JWT_ACCESS_TTL ?? "15m",
      refreshTtl: process.env.JWT_REFRESH_TTL ?? "7d",
    },
    storage: {
      root: process.env.STORAGE_ROOT ?? "./storage-data",
      publicBaseUrl: process.env.PUBLIC_BASE_URL ?? "http://localhost:3001/files",
    },
    redis: {
      host: process.env.REDIS_HOST ?? "localhost",
      port: Number(process.env.REDIS_PORT ?? 6379),
    },
    maxUploadBytes: Number(process.env.MAX_UPLOAD_BYTES ?? 25 * 1024 * 1024),
  };
}
