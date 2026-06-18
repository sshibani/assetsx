import type {
  AssetDTO,
  AuthTokens,
  ChannelInfoLike,
  PublicationDTO,
} from "./types";

export interface ApiClientOptions {
  baseUrl: string;
  fetchFn?: typeof fetch;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
  }
}

export class ApiClient {
  private readonly baseUrl: string;
  private readonly fetchFn: typeof fetch;
  private accessToken: string | null = null;

  constructor(options: ApiClientOptions) {
    this.baseUrl = options.baseUrl;
    // Wrap the global fetch so it is always invoked with the correct `this`
    // context. Assigning `fetch` directly to an instance property and calling
    // it as `this.fetchFn(...)` throws "Illegal invocation" in browsers.
    this.fetchFn = options.fetchFn ?? ((input, init) => fetch(input, init));
  }

  setAccessToken(token: string | null): void {
    this.accessToken = token;
  }

  getAccessToken(): string | null {
    return this.accessToken;
  }

  private async request<T>(
    path: string,
    init: { method?: string; body?: unknown; isForm?: boolean } = {},
  ): Promise<T> {
    const headers: Record<string, string> = {};
    if (this.accessToken) {
      headers.Authorization = `Bearer ${this.accessToken}`;
    }
    let body: BodyInit | undefined;
    if (init.isForm) {
      body = init.body as BodyInit;
    } else if (init.body !== undefined) {
      headers["Content-Type"] = "application/json";
      body = JSON.stringify(init.body);
    }

    const res = await this.fetchFn(`${this.baseUrl}${path}`, {
      method: init.method ?? "GET",
      headers,
      body,
    });

    if (!res.ok) {
      throw new ApiError(`Request to ${path} failed with status ${res.status}`, res.status);
    }
    if (res.status === 204) return undefined as T;
    return (await res.json()) as T;
  }

  // --- Auth ---
  async login(email: string, password: string): Promise<AuthTokens> {
    const tokens = await this.request<AuthTokens>("/api/auth/login", {
      method: "POST",
      body: { email, password },
    });
    this.setAccessToken(tokens.accessToken);
    return tokens;
  }

  async me() {
    return this.request<{ id: string; email: string; role: string }>(
      "/api/auth/me",
    );
  }

  // --- Assets ---
  async listAssets(): Promise<{ items: AssetDTO[] }> {
    return this.request<{ items: AssetDTO[] }>("/api/assets");
  }

  async getAsset(id: string): Promise<AssetDTO> {
    return this.request<AssetDTO>(`/api/assets/${id}`);
  }

  async uploadAsset(file: File): Promise<AssetDTO> {
    const form = new FormData();
    form.set("file", file);
    return this.request<AssetDTO>("/api/assets", {
      method: "POST",
      body: form,
      isForm: true,
    });
  }

  async updateAsset(
    id: string,
    data: Partial<
      Pick<AssetDTO, "title" | "description" | "altText" | "tags" | "expiresAt">
    >,
  ): Promise<AssetDTO> {
    return this.request<AssetDTO>(`/api/assets/${id}`, {
      method: "PATCH",
      body: data,
    });
  }

  async deleteAsset(id: string): Promise<void> {
    await this.request<void>(`/api/assets/${id}`, { method: "DELETE" });
  }

  // --- Publishing ---
  async listChannels(): Promise<{ items: ChannelInfoLike[] }> {
    return this.request<{ items: ChannelInfoLike[] }>("/api/channels");
  }

  async publish(assetId: string, channelIds: string[]): Promise<void> {
    await this.request<void>(`/api/assets/${assetId}/publish`, {
      method: "POST",
      body: { channelIds },
    });
  }

  async listPublications(assetId: string): Promise<{ items: PublicationDTO[] }> {
    return this.request<{ items: PublicationDTO[] }>(
      `/api/assets/${assetId}/publications`,
    );
  }
}
