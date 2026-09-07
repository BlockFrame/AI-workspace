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

export type ExportUsageCsvResult =
  | { status: "cancelled" }
  | { status: "saved"; filePath: string; rowCount: number };

export type DataProtectionSettings = Record<ServiceId, boolean>;

export type BroadcastMode = "standard" | "deep-research";
export type BroadcastDeliveryStatus = "submitted" | "unsupported" | "failed";

export type ThemePreference = "light" | "dark" | "system";
export type TextSizePreference = "standard" | "large" | "extra-large";

export interface AppPreferences {
  theme: ThemePreference;
  textSize: TextSizePreference;
  appZoomPercent: number;
  highContrast: boolean;
  reducedMotion: boolean;
  dataProtectionByService: DataProtectionSettings;
}

export interface AccountProviderSettings {
  accountId: string;
  defaultBroadcastMode: BroadcastMode;
  contextNote: string;
  includeContextInPrompts: boolean;
  zoomPercent: number;
  updatedAt: string;
}

export interface BroadcastRequest {
  accountIds: string[];
  prompt: string;
  mode: BroadcastMode;
  allowSensitiveData?: boolean;
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

export type PromptHistorySource = "broadcast" | "schedule";

export interface PromptHistoryEntry {
  id: string;
  accountIds: string[];
  prompt: string;
  mode: BroadcastMode;
  source: PromptHistorySource;
  createdAt: string;
}

export interface PromptTemplate {
  id: string;
  name: string;
  category?: string;
  description?: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export interface PromptTemplateInput {
  name: string;
  category?: string;
  description?: string;
  content: string;
}

export type ScheduleRecurrence = "once" | "daily" | "weekly";
export type ScheduleOutcomeStatus = "running" | "success" | "partial" | "failed";

export interface ScheduleOutcome {
  status: ScheduleOutcomeStatus;
  completedAt: string;
  message: string;
}

export interface ScheduledPrompt {
  id: string;
  accountIds: string[];
  prompt: string;
  mode: BroadcastMode;
  recurrence: ScheduleRecurrence;
  timeZone: string;
  localTime: string;
  enabled: boolean;
  nextRunAt: string | null;
  lastRunAt?: string;
  lastOutcome?: ScheduleOutcome;
  allowSensitiveData: boolean;
  sensitiveDataConsentDigests?: Record<string, string>;
  createdAt: string;
  updatedAt: string;
}

export interface CreateScheduleRequest {
  accountIds: string[];
  prompt: string;
  mode: BroadcastMode;
  recurrence: ScheduleRecurrence;
  firstRunAt: string;
  timeZone: string;
  localStartAt: string;
  allowSensitiveData?: boolean;
}

export interface ProviderSelectionResult {
  accountId: string;
  accounts: AccountProfile[];
}

export interface DesktopApi {
  listAccounts(): Promise<AccountProfile[]>;
  addAccount(serviceId: ServiceId, label: string): Promise<AccountProfile[]>;
  removeAccount(accountId: string): Promise<RemoveAccountResult>;
  selectAccount(accountId: string): Promise<AccountProfile[]>;
  selectRecentAccount(serviceId: ServiceId): Promise<ProviderSelectionResult>;
  setViewBounds(bounds: ViewBounds): void;
  setViewVisible(visible: boolean): void;
  goBack(): Promise<void>;
  goForward(): Promise<void>;
  reload(): Promise<void>;
  openCurrentInBrowser(): Promise<void>;
  getUsageSummary(periodDays: UsagePeriodDays): Promise<UsageSummary>;
  exportUsageCsv(periodDays: UsagePeriodDays): Promise<ExportUsageCsvResult>;
  resetUsage(periodDays: UsagePeriodDays): Promise<ResetUsageResult>;
  getPreferences(): Promise<AppPreferences>;
  setPreferences(preferences: AppPreferences): Promise<AppPreferences>;
  setDataProtectionSettings(settings: DataProtectionSettings): Promise<void>;
  listAccountSettings(): Promise<AccountProviderSettings[]>;
  updateAccountSettings(
    accountId: string,
    settings: Omit<AccountProviderSettings, "accountId" | "updatedAt">
  ): Promise<AccountProviderSettings>;
  listPromptHistory(): Promise<PromptHistoryEntry[]>;
  clearPromptHistory(): Promise<void>;
  listPromptTemplates(): Promise<PromptTemplate[]>;
  createPromptTemplate(input: PromptTemplateInput): Promise<PromptTemplate>;
  updatePromptTemplate(id: string, input: PromptTemplateInput): Promise<PromptTemplate>;
  deletePromptTemplate(id: string): Promise<boolean>;
  listSchedules(): Promise<ScheduledPrompt[]>;
  createSchedule(request: CreateScheduleRequest): Promise<ScheduledPrompt>;
  setScheduleEnabled(scheduleId: string, enabled: boolean): Promise<ScheduledPrompt>;
  removeSchedule(scheduleId: string): Promise<void>;
  listResearchProjects(): Promise<import("./research-types").ResearchProject[]>;
  createResearchProject(
    input: import("./research-types").CreateResearchProjectInput
  ): Promise<import("./research-types").ResearchProject>;
  addResearchRound(
    projectId: string,
    input: import("./research-types").AddResearchRoundInput
  ): Promise<import("./research-types").ResearchProject>;
  updateResearchRound(
    projectId: string,
    roundId: string,
    input: import("./research-types").UpdateResearchRoundInput
  ): Promise<import("./research-types").ResearchProject>;
  deleteResearchProject(projectId: string): Promise<boolean>;
  broadcastResearchPrompt(request: BroadcastRequest): Promise<BroadcastResult>;
  listGeoStudies(): Promise<import("./geo-types").GeoStudy[]>;
  createGeoStudy(
    input: import("./geo-types").CreateGeoStudyInput
  ): Promise<import("./geo-types").GeoStudy>;
  startGeoStudy(studyId: string): Promise<import("./geo-types").GeoStudy>;
  pauseGeoStudy(studyId: string): Promise<import("./geo-types").GeoStudy>;
  retryGeoStudyFailures(studyId: string): Promise<import("./geo-types").GeoStudy>;
  updateGeoResult(
    studyId: string,
    resultId: string,
    input: import("./geo-types").UpdateGeoResultInput
  ): Promise<import("./geo-types").GeoStudy>;
  deleteGeoStudy(studyId: string): Promise<boolean>;
  broadcastPrompt(request: BroadcastRequest): Promise<BroadcastResult>;
  releaseBroadcastViews(): Promise<void>;
  confirmAppClose(): void;
  cancelAppClose(): void;
  onViewState(listener: (state: ViewState) => void): () => void;
  onAppBeforeClose(listener: () => void): () => void;
  onGeoStudyProgress(
    listener: (event: import("./geo-types").GeoStudyProgressEvent) => void
  ): () => void;
  onSchedulesChanged(listener: (schedules: ScheduledPrompt[]) => void): () => void;
  onProviderShortcut(listener: (serviceId: ServiceId) => void): () => void;
  onPreferencesChanged(listener: (preferences: AppPreferences) => void): () => void;
}
