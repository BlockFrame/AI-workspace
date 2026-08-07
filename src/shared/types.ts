export type ServiceId =
  | "chatgpt"
  | "claude"
  | "perplexity"
  | "gemini"
  | "zai"
  | "deepseek"
  | "kimi"
  | "mistral";

export interface ServiceDefinition {
  id: ServiceId;
  name: string;
  shortName: string;
  homeUrl: string;
  trustedHosts: readonly string[];
}

export interface AccountProfile {
  id: string;
  serviceId: ServiceId;
  label: string;
  createdAt: string;
  lastUsedAt: string;
}

export interface ViewBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ViewState {
  accountId: string;
  url: string;
  title: string;
  isLoading: boolean;
  canGoBack: boolean;
  canGoForward: boolean;
  error?: string;
}

export interface RemoveAccountResult {
  removed: boolean;
  accounts: AccountProfile[];
}

export type UsagePeriodDays = 7 | 30;

export interface ServiceUsageSummary {
  serviceId: ServiceId;
  activeMs: number;
  opens: number;
  switches: number;
}

export interface UsageSummary {
  periodDays: UsagePeriodDays;
  generatedAt: string;
  totalActiveMs: number;
  totalOpens: number;
  totalSwitches: number;
  mostUsedServiceId: ServiceId | null;
  services: ServiceUsageSummary[];
}

export interface ResetUsageResult {
  reset: boolean;
  summary: UsageSummary;
}

export type DataProtectionSettings = Record<ServiceId, boolean>;

export type BroadcastMode = "standard" | "deep-research";
export type BroadcastDeliveryStatus = "submitted" | "unsupported" | "failed";

export interface BroadcastRequest {
  accountIds: string[];
  prompt: string;
  mode: BroadcastMode;
}

export interface BroadcastDeliveryResult {
  accountId: string;
  serviceId: ServiceId;
  status: BroadcastDeliveryStatus;
  message: string;
}

export interface BroadcastResult {
  deliveries: BroadcastDeliveryResult[];
}

export interface DesktopApi {
  listAccounts(): Promise<AccountProfile[]>;
  addAccount(serviceId: ServiceId, label: string): Promise<AccountProfile[]>;
  removeAccount(accountId: string): Promise<RemoveAccountResult>;
  selectAccount(accountId: string): Promise<void>;
  setViewBounds(bounds: ViewBounds): void;
  setViewVisible(visible: boolean): void;
  goBack(): Promise<void>;
  goForward(): Promise<void>;
  reload(): Promise<void>;
  openCurrentInBrowser(): Promise<void>;
  getUsageSummary(periodDays: UsagePeriodDays): Promise<UsageSummary>;
  resetUsage(periodDays: UsagePeriodDays): Promise<ResetUsageResult>;
  setDataProtectionSettings(settings: DataProtectionSettings): Promise<void>;
  broadcastPrompt(request: BroadcastRequest): Promise<BroadcastResult>;
  onViewState(listener: (state: ViewState) => void): () => void;
}
