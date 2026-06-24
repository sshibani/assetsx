import type {
  AccountDTO,
  AccountMembershipDTO,
  AccountRole,
  AccountSettingsDTO,
  AdminAccountDTO,
  AdminUserDTO,
  AdminUserDetailDTO,
  AuthAccountContext,
  AssetDTO,
  AssetTimelineItemDTO,
  AuthTokens,
  BundleDTO,
  BundleDetailDTO,
  BundleShareCreatedDTO,
  PublicBundleDTO,
  ChannelInfoLike,
  DateTimeFormat,
  GlobalRole,
  UserDTO,
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

  async signup(
    accountName: string,
    email: string,
    password: string,
  ): Promise<AuthTokens> {
    const tokens = await this.request<AuthTokens>("/api/auth/signup", {
      method: "POST",
      body: { accountName, email, password },
    });
    this.setAccessToken(tokens.accessToken);
    return tokens;
  }

  async switchAccount(accountId: string): Promise<AuthTokens> {
    const tokens = await this.request<AuthTokens>("/api/auth/switch-account", {
      method: "POST",
      body: { accountId },
    });
    this.setAccessToken(tokens.accessToken);
    return tokens;
  }

  async me() {
    return this.request<
      UserDTO & {
        activeAccount: string | null;
        accounts: AuthAccountContext[];
      }
    >("/api/auth/me");
  }

  async listAccounts(): Promise<{ items: AuthAccountContext["account"][] }> {
    return this.request<{ items: AuthAccountContext["account"][] }>("/api/accounts");
  }

  // --- Account administration ---
  async createAccount(name: string, slug: string): Promise<AccountDTO> {
    return this.request<AccountDTO>("/api/accounts", {
      method: "POST",
      body: { name, slug },
    });
  }

  async getAccount(accountId: string): Promise<AccountDTO> {
    return this.request<AccountDTO>(`/api/accounts/${accountId}`);
  }

  async updateAccount(
    accountId: string,
    data: Partial<Pick<AccountDTO, "name" | "slug" | "status">>,
  ): Promise<AccountDTO> {
    return this.request<AccountDTO>(`/api/accounts/${accountId}`, {
      method: "PATCH",
      body: data,
    });
  }

  async getAccountSettings(accountId: string): Promise<AccountSettingsDTO> {
    return this.request<AccountSettingsDTO>(
      `/api/accounts/${accountId}/settings`,
    );
  }

  async updateAccountSettings(
    accountId: string,
    data: { dateTimeFormat?: DateTimeFormat; timezone?: string },
  ): Promise<AccountSettingsDTO> {
    return this.request<AccountSettingsDTO>(
      `/api/accounts/${accountId}/settings`,
      { method: "PUT", body: data },
    );
  }

  // --- Members ---
  async listMembers(
    accountId: string,
  ): Promise<{ items: AccountMembershipDTO[] }> {
    return this.request<{ items: AccountMembershipDTO[] }>(
      `/api/accounts/${accountId}/members`,
    );
  }

  async addMember(
    accountId: string,
    email: string,
    role: AccountRole,
  ): Promise<AccountMembershipDTO> {
    return this.request<AccountMembershipDTO>(
      `/api/accounts/${accountId}/members`,
      { method: "POST", body: { email, role } },
    );
  }

  async updateMember(
    accountId: string,
    membershipId: string,
    data: { role?: AccountRole; status?: "active" | "disabled" },
  ): Promise<AccountMembershipDTO> {
    return this.request<AccountMembershipDTO>(
      `/api/accounts/${accountId}/members/${membershipId}`,
      { method: "PATCH", body: data },
    );
  }

  async removeMember(accountId: string, membershipId: string): Promise<void> {
    await this.request<void>(
      `/api/accounts/${accountId}/members/${membershipId}`,
      { method: "DELETE" },
    );
  }

  // --- Platform admin: accounts ---
  async listAdminAccounts(q?: string): Promise<{ items: AdminAccountDTO[] }> {
    const query = q ? `?q=${encodeURIComponent(q)}` : "";
    return this.request<{ items: AdminAccountDTO[] }>(
      `/api/admin/accounts${query}`,
    );
  }

  // --- Platform admin: users ---
  async listAdminUsers(q?: string): Promise<{ items: AdminUserDTO[] }> {
    const query = q ? `?q=${encodeURIComponent(q)}` : "";
    return this.request<{ items: AdminUserDTO[] }>(`/api/admin/users${query}`);
  }

  async getAdminUser(userId: string): Promise<AdminUserDetailDTO> {
    return this.request<AdminUserDetailDTO>(`/api/admin/users/${userId}`);
  }

  async setUserGlobalRole(
    userId: string,
    globalRole: GlobalRole,
  ): Promise<AdminUserDetailDTO> {
    return this.request<AdminUserDetailDTO>(`/api/admin/users/${userId}`, {
      method: "PATCH",
      body: { globalRole },
    });
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
      Pick<AssetDTO, "title" | "description" | "expiresAt">
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

  async listAssetTimeline(id: string): Promise<{ items: AssetTimelineItemDTO[] }> {
    return this.request<{ items: AssetTimelineItemDTO[] }>(
      `/api/assets/${id}/timeline`,
    );
  }

  async createAssetComment(
    id: string,
    body: string,
  ): Promise<AssetTimelineItemDTO> {
    return this.request<AssetTimelineItemDTO>(`/api/assets/${id}/comments`, {
      method: "POST",
      body: { body },
    });
  }

  // --- Bundles ---
  async listBundles(): Promise<{ items: BundleDTO[] }> {
    return this.request<{ items: BundleDTO[] }>("/api/bundles");
  }

  async getBundle(id: string): Promise<BundleDetailDTO> {
    return this.request<BundleDetailDTO>(`/api/bundles/${id}`);
  }

  /** Bundles in the account that contain the given asset. */
  async listAssetBundles(assetId: string): Promise<{ items: BundleDTO[] }> {
    return this.request<{ items: BundleDTO[] }>(
      `/api/assets/${assetId}/bundles`,
    );
  }

  async createBundle(data: {
    title: string;
    description?: string;
  }): Promise<BundleDTO> {
    return this.request<BundleDTO>("/api/bundles", {
      method: "POST",
      body: data,
    });
  }

  async updateBundle(
    id: string,
    data: Partial<Pick<BundleDTO, "title" | "description">>,
  ): Promise<BundleDTO> {
    return this.request<BundleDTO>(`/api/bundles/${id}`, {
      method: "PATCH",
      body: data,
    });
  }

  async deleteBundle(id: string): Promise<void> {
    await this.request<void>(`/api/bundles/${id}`, { method: "DELETE" });
  }

  async addAssetToBundle(
    bundleId: string,
    assetId: string,
  ): Promise<BundleDTO> {
    return this.request<BundleDTO>(`/api/bundles/${bundleId}/assets`, {
      method: "POST",
      body: { assetId },
    });
  }

  async removeAssetFromBundle(
    bundleId: string,
    assetId: string,
  ): Promise<void> {
    await this.request<void>(`/api/bundles/${bundleId}/assets/${assetId}`, {
      method: "DELETE",
    });
  }

  async createBundleShare(
    bundleId: string,
    data: { expiresInDays?: number } = {},
  ): Promise<BundleShareCreatedDTO> {
    return this.request<BundleShareCreatedDTO>(
      `/api/bundles/${bundleId}/share`,
      { method: "POST", body: data },
    );
  }

  async revokeBundleShare(bundleId: string, shareId: string): Promise<void> {
    await this.request<void>(`/api/bundles/${bundleId}/share/${shareId}`, {
      method: "DELETE",
    });
  }

  /** Public, unauthenticated read of a shared bundle by token. */
  async getSharedBundle(token: string): Promise<PublicBundleDTO> {
    return this.request<PublicBundleDTO>(`/api/shared/bundles/${token}`);
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
