import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  session,
  shell,
  WebContentsView,
  type Input
} from "electron";
import { createHash, randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { autoUpdater } from "electron-updater";
import { scanSensitiveData } from "../src/shared/sensitive-data";
import { SERVICES, SERVICE_BY_ID, isServiceId } from "../src/shared/services";
import {
  normalizeAddResearchRoundInput,
  normalizeCreateResearchProjectInput,
  normalizeUpdateResearchRoundInput,
  ResearchStore
} from "./research-store";
import { MAX_RESEARCH_OPTIMIZATION_PROMPT_LENGTH } from "../src/shared/research-types";
import {
  GeoStudyStore,
  normalizeCreateGeoStudyInput,
  normalizeUpdateGeoResultInput
} from "./geo-store";
import type {
  GeoCapturedResponse,
  GeoCaptureSnapshot,
  GeoResult
} from "../src/shared/geo-types";
import { MAX_GEO_RESPONSE_LENGTH } from "../src/shared/geo-types";
import type {
  AccountProfile,
  AccountProviderSettings,
  AppPreferences,
  AppUpdateStatus,
  BroadcastDeliveryResult,
  BroadcastMode,
  BroadcastRequest,
  BroadcastResult,
  CreateScheduleRequest,
  DataProtectionSettings,
  ExportUsageCsvResult,
  PromptHistoryEntry,
  PromptTemplate,
  PromptTemplateInput,
  ProviderSelectionResult,
  RemoveAccountResult,
  ResetUsageResult,
  ScheduledPrompt,
  ScheduleOutcome,
  ScheduleRecurrence,
  ServiceId,
  ServiceUsageSummary,
  UsagePeriodDays,
  UsageSummary,
  ViewBounds,
  ViewState
} from "../src/shared/types";

const MAX_WARM_VIEWS = 3;
const APP_ZOOM_LEVELS = [75, 80, 90, 100, 110, 125, 150, 175, 200] as const;
const DEFAULT_DATA_PROTECTION_SETTINGS: DataProtectionSettings = {
  chatgpt: true,
  claude: true,
  perplexity: true,
  gemini: true,
  zai: true,
  deepseek: true,
  kimi: true,
  mistral: true
};
const DEFAULT_PREFERENCES: AppPreferences = {
  theme: "system",
  textSize: "standard",
  appZoomPercent: 100,
  highContrast: false,
  reducedMotion: false,
  updateChannel: "stable",
  dataProtectionByService: { ...DEFAULT_DATA_PROTECTION_SETTINGS }
};
let dataProtectionSettings: DataProtectionSettings = {
  ...DEFAULT_DATA_PROTECTION_SETTINGS
};
const AUTH_HOSTS_BY_SERVICE: Readonly<Record<ServiceId, readonly string[]>> = {
  chatgpt: [
    "accounts.google.com",
    "appleid.apple.com",
    "login.microsoftonline.com"
  ],
  claude: ["accounts.google.com", "appleid.apple.com"],
  perplexity: ["accounts.google.com", "appleid.apple.com"],
  gemini: ["accounts.google.com"],
  zai: ["accounts.google.com", "appleid.apple.com", "auth.z.ai", "passport.z.ai"],
  deepseek: ["accounts.google.com", "auth.deepseek.com"],
  kimi: ["accounts.google.com", "login.kimi.com"],
  mistral: [
    "accounts.google.com",
    "appleid.apple.com",
    "login.microsoftonline.com",
    "auth.mistral.ai"
  ]
};

interface ManagedView {
  accountId: string;
  serviceId: ServiceId;
  partition: string;
  view: WebContentsView;
  lastActivatedAt: number;
  attached: boolean;
}

interface UsageRecord {
  date: string;
  accountId: string;
  serviceId: ServiceId;
  activeMs: number;
  opens: number;
  switches: number;
}

type CsvValue = string | number;

interface BroadcastAdapter {
  composerSelectors: readonly string[];
  sendSelectors: readonly string[];
  responseSelectors: readonly string[];
  streamingSelectors: readonly string[];
  deepResearchLabels: readonly string[];
  deepResearchOpeners: readonly string[];
  researchModeName: string;
}

type StoredScheduledPrompt = Omit<ScheduledPrompt, "timeZone" | "localTime"> &
  Partial<Pick<ScheduledPrompt, "timeZone" | "localTime">>;

const BROADCAST_ADAPTERS: Readonly<Record<ServiceId, BroadcastAdapter>> = {
  chatgpt: {
    composerSelectors: [
      "#prompt-textarea",
      "textarea[data-testid='prompt-textarea']",
      "div[contenteditable='true'][data-lexical-editor='true']"
    ],
    sendSelectors: [
      "button[data-testid='send-button']",
      "button[aria-label*='Send']"
    ],
    responseSelectors: [
      "[data-message-author-role='assistant']",
      "article[data-testid^='conversation-turn-']:has([data-message-author-role='assistant'])"
    ],
    streamingSelectors: [
      "button[data-testid='stop-button']",
      "button[aria-label*='Stop generating']"
    ],
    deepResearchLabels: ["deep research"],
    deepResearchOpeners: ["tools"],
    researchModeName: "Deep Research mode"
  },
  claude: {
    composerSelectors: [
      "div.ProseMirror[contenteditable='true']",
      "div[contenteditable='true'][data-placeholder]",
      "textarea"
    ],
    sendSelectors: [
      "button[aria-label*='Send']",
      "button[data-testid*='send']"
    ],
    responseSelectors: [
      "[data-testid='assistant-message']",
      "[data-is-streaming] .font-claude-response",
      ".font-claude-response"
    ],
    streamingSelectors: [
      "button[aria-label*='Stop']",
      "[data-is-streaming='true']"
    ],
    deepResearchLabels: ["research"],
    deepResearchOpeners: ["search and tools", "tools"],
    researchModeName: "Research mode"
  },
  perplexity: {
    composerSelectors: [
      "textarea[placeholder]",
      "textarea",
      "div[contenteditable='true']"
    ],
    sendSelectors: [
      "button[aria-label*='Submit']",
      "button[aria-label*='Send']",
      "form:has(textarea, [contenteditable='true']) button[type='submit']"
    ],
    responseSelectors: [
      "[data-testid='answer']",
      "[data-testid*='assistant']",
      "main .prose"
    ],
    streamingSelectors: [
      "button[aria-label*='Stop']",
      "[data-testid*='loading']"
    ],
    deepResearchLabels: ["deep research", "research"],
    deepResearchOpeners: ["search mode", "mode"],
    researchModeName: "Deep Research mode"
  },
  gemini: {
    composerSelectors: [
      "rich-textarea div[contenteditable='true']",
      "div[contenteditable='true'][aria-label]",
      "textarea"
    ],
    sendSelectors: [
      "button[aria-label*='Send message']",
      "button[aria-label*='Send']",
      "button.send-button"
    ],
    responseSelectors: [
      "model-response",
      "message-content",
      ".model-response-text",
      "[data-test-id*='response']"
    ],
    streamingSelectors: [
      "button[aria-label*='Stop response']",
      "mat-progress-spinner"
    ],
    deepResearchLabels: ["deep research"],
    deepResearchOpeners: ["tools", "mode"],
    researchModeName: "Deep Research mode"
  },
  zai: {
    composerSelectors: [
      "textarea[placeholder]",
      "div[contenteditable='true']",
      "textarea"
    ],
    sendSelectors: [
      "button[aria-label*='Send']",
      "button[aria-label*='Submit']",
      "form:has(textarea, [contenteditable='true']) button[type='submit']"
    ],
    responseSelectors: [
      "[data-role='assistant']",
      "[data-testid*='assistant']",
      ".message-content"
    ],
    streamingSelectors: [
      "button[aria-label*='Stop']",
      "[class*='loading']"
    ],
    deepResearchLabels: ["deep research", "research"],
    deepResearchOpeners: ["tools", "mode"],
    researchModeName: "Deep Research mode"
  },
  deepseek: {
    composerSelectors: [
      "textarea#chat-input",
      "textarea[placeholder]",
      "div[contenteditable='true']",
      "textarea"
    ],
    sendSelectors: [
      "button[aria-label*='Send']",
      "button[aria-label*='Submit']",
      "form:has(textarea, [contenteditable='true']) button[type='submit']"
    ],
    responseSelectors: [
      "[data-role='assistant']",
      ".ds-markdown",
      ".markdown"
    ],
    streamingSelectors: [
      "button[aria-label*='Stop']",
      "[class*='loading']"
    ],
    deepResearchLabels: ["deepthink", "deepthink (r1)"],
    deepResearchOpeners: ["tools", "mode"],
    researchModeName: "DeepThink mode"
  },
  kimi: {
    composerSelectors: [
      "textarea[placeholder]",
      "div[contenteditable='true']",
      "textarea"
    ],
    sendSelectors: [
      "button[aria-label*='Send']",
      "button[aria-label*='Submit']",
      "form:has(textarea, [contenteditable='true']) button[type='submit']"
    ],
    responseSelectors: [
      "[data-role='assistant']",
      "[class*='segment-assistant']",
      ".markdown"
    ],
    streamingSelectors: [
      "button[aria-label*='Stop']",
      "[class*='loading']"
    ],
    deepResearchLabels: ["deep research", "research"],
    deepResearchOpeners: ["tools", "mode"],
    researchModeName: "Deep Research mode"
  },
  mistral: {
    composerSelectors: [
      "textarea[placeholder]",
      "div.ProseMirror[contenteditable='true']",
      "div[contenteditable='true']",
      "textarea"
    ],
    sendSelectors: [
      "button[aria-label*='Send']",
      "button[aria-label*='Submit']",
      "form:has(textarea, [contenteditable='true']) button[type='submit']"
    ],
    responseSelectors: [
      "[data-message-author-role='assistant']",
      "[data-testid*='assistant']",
      ".prose"
    ],
    streamingSelectors: [
      "button[aria-label*='Stop']",
      "[data-testid*='loading']"
    ],
    deepResearchLabels: ["deep research", "research"],
    deepResearchOpeners: ["tools", "mode"],
    researchModeName: "Deep Research mode"
  }
};

class AccountStore {
  private accounts: AccountProfile[] = [];
  private readonly filePath: string;

  constructor(userDataPath: string) {
    this.filePath = path.join(userDataPath, "accounts.json");
  }

  async load(): Promise<void> {
    try {
      const content = await fs.readFile(this.filePath, "utf8");
      const parsed: unknown = JSON.parse(content);
      if (!Array.isArray(parsed)) {
        throw new Error("Account metadata must be an array.");
      }

      this.accounts = parsed.filter(isAccountProfile);
    } catch (error) {
      if (isNodeError(error) && error.code === "ENOENT") {
        this.accounts = [];
        return;
      }
      throw error;
    }
  }

  list(): AccountProfile[] {
    return this.accounts.map((account) => ({ ...account }));
  }

  get(accountId: string): AccountProfile | undefined {
    return this.accounts.find((account) => account.id === accountId);
  }

  async add(serviceId: ServiceId, label: string): Promise<AccountProfile[]> {
    const now = new Date().toISOString();
    this.accounts.push({
      id: randomUUID(),
      serviceId,
      label,
      createdAt: now,
      lastUsedAt: now
    });
    await this.save();
    return this.list();
  }

  async touch(accountId: string): Promise<void> {
    const account = this.get(accountId);
    if (!account) {
      throw new Error("Account not found.");
    }
    account.lastUsedAt = new Date().toISOString();
    await this.save();
  }

  async remove(accountId: string): Promise<AccountProfile[]> {
    const nextAccounts = this.accounts.filter((account) => account.id !== accountId);
    if (nextAccounts.length === this.accounts.length) {
      throw new Error("Account not found.");
    }
    this.accounts = nextAccounts;
    await this.save();
    return this.list();
  }

  private async save(): Promise<void> {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    const temporaryPath = `${this.filePath}.tmp`;
    await fs.writeFile(temporaryPath, JSON.stringify(this.accounts, null, 2), "utf8");
    await fs.rename(temporaryPath, this.filePath);
  }
}

class UsageStore {
  private records: UsageRecord[] = [];
  private readonly filePath: string;
  private saveQueue: Promise<void> = Promise.resolve();

  constructor(userDataPath: string) {
    this.filePath = path.join(userDataPath, "usage.json");
  }

  async load(): Promise<void> {
    try {
      const content = await fs.readFile(this.filePath, "utf8");
      const parsed: unknown = JSON.parse(content);
      if (!Array.isArray(parsed)) {
        throw new Error("Usage data must be an array.");
      }
      this.records = parsed.filter(isUsageRecord);
    } catch (error) {
      if (isNodeError(error) && error.code === "ENOENT") {
        this.records = [];
        return;
      }
      throw error;
    }
  }

  recordOpen(account: AccountProfile, switched: boolean): Promise<void> {
    const record = this.getOrCreateToday(account);
    record.opens += 1;
    if (switched) {
      record.switches += 1;
    }
    return this.save();
  }

  recordActive(account: AccountProfile, activeMs: number): Promise<void> {
    if (!Number.isFinite(activeMs) || activeMs <= 0) {
      return Promise.resolve();
    }
    this.getOrCreateToday(account).activeMs += Math.round(activeMs);
    return this.save();
  }

  summarize(periodDays: UsagePeriodDays): UsageSummary {
    const cutoff = usageCutoff(periodDays);
    const services = new Map<ServiceId, ServiceUsageSummary>(
      [...SERVICE_BY_ID.keys()].map((serviceId) => [
        serviceId,
        { serviceId, activeMs: 0, opens: 0, switches: 0 }
      ])
    );

    for (const record of this.records) {
      if (record.date < cutoff) {
        continue;
      }
      const service = services.get(record.serviceId);
      if (!service) {
        continue;
      }
      service.activeMs += record.activeMs;
      service.opens += record.opens;
      service.switches += record.switches;
    }

    const serviceSummaries = [...services.values()];
    const mostUsed = [...serviceSummaries]
      .filter((service) => service.activeMs > 0 || service.opens > 0)
      .sort((left, right) => right.activeMs - left.activeMs || right.opens - left.opens)[0];

    return {
      periodDays,
      generatedAt: new Date().toISOString(),
      totalActiveMs: serviceSummaries.reduce((total, service) => total + service.activeMs, 0),
      totalOpens: serviceSummaries.reduce((total, service) => total + service.opens, 0),
      totalSwitches: serviceSummaries.reduce((total, service) => total + service.switches, 0),
      mostUsedServiceId: mostUsed?.serviceId ?? null,
      services: serviceSummaries
    };
  }

  list(periodDays: UsagePeriodDays): UsageRecord[] {
    const cutoff = usageCutoff(periodDays);
    const periodEnd = usageDate(new Date());
    return this.records
      .filter((record) => record.date >= cutoff && record.date <= periodEnd)
      .map((record) => ({ ...record }));
  }

  async reset(periodDays: UsagePeriodDays): Promise<void> {
    const cutoff = usageCutoff(periodDays);
    this.records = this.records.filter((record) => record.date < cutoff);
    await this.save();
  }

  waitForPendingSaves(): Promise<void> {
    return this.saveQueue;
  }

  private getOrCreateToday(account: AccountProfile): UsageRecord {
    const date = usageDate(new Date());
    let record = this.records.find(
      (candidate) =>
        candidate.date === date &&
        candidate.accountId === account.id &&
        candidate.serviceId === account.serviceId
    );
    if (!record) {
      record = {
        date,
        accountId: account.id,
        serviceId: account.serviceId,
        activeMs: 0,
        opens: 0,
        switches: 0
      };
      this.records.push(record);
    }
    return record;
  }

  private save(): Promise<void> {
    const write = async () => {
      await fs.mkdir(path.dirname(this.filePath), { recursive: true });
      const temporaryPath = `${this.filePath}.tmp`;
      await fs.writeFile(temporaryPath, JSON.stringify(this.records, null, 2), "utf8");
      await fs.rename(temporaryPath, this.filePath);
    };
    this.saveQueue = this.saveQueue.then(write, write);
    return this.saveQueue;
  }
}

class SecureJsonFile<T> {
  private saveQueue: Promise<void> = Promise.resolve();

  constructor(private readonly filePath: string) {}

  async read(fallback: T): Promise<unknown | T> {
    try {
      return JSON.parse(await fs.readFile(this.filePath, "utf8")) as unknown;
    } catch (error) {
      if (isNodeError(error) && error.code === "ENOENT") {
        return fallback;
      }
      console.error(`Unable to read ${path.basename(this.filePath)}; using safe defaults.`, error);
      return fallback;
    }
  }

  write(value: T): Promise<void> {
    const save = async () => {
      await fs.mkdir(path.dirname(this.filePath), { recursive: true });
      const temporaryPath = `${this.filePath}.tmp`;
      await fs.writeFile(temporaryPath, JSON.stringify(value, null, 2), {
        encoding: "utf8",
        mode: 0o600
      });
      await fs.rename(temporaryPath, this.filePath);
    };
    this.saveQueue = this.saveQueue.then(save, save);
    return this.saveQueue;
  }

  waitForPendingSaves(): Promise<void> {
    return this.saveQueue;
  }
}

class PreferencesStore {
  private preferences: AppPreferences = {
    ...DEFAULT_PREFERENCES,
    dataProtectionByService: { ...DEFAULT_DATA_PROTECTION_SETTINGS }
  };
  private readonly file: SecureJsonFile<AppPreferences>;

  constructor(userDataPath: string) {
    this.file = new SecureJsonFile(path.join(userDataPath, "preferences.json"));
  }

  async load(): Promise<void> {
    const normalized = normalizePreferences(await this.file.read(DEFAULT_PREFERENCES));
    if (normalized) {
      this.preferences = normalized;
    }
  }

  get(): AppPreferences {
    return {
      ...this.preferences,
      dataProtectionByService: { ...this.preferences.dataProtectionByService }
    };
  }

  async set(value: AppPreferences): Promise<AppPreferences> {
    this.preferences = value;
    await this.file.write(this.preferences);
    return this.get();
  }

  waitForPendingSaves(): Promise<void> {
    return this.file.waitForPendingSaves();
  }
}

class AccountSettingsStore {
  private settings = new Map<string, AccountProviderSettings>();
  private readonly file: SecureJsonFile<AccountProviderSettings[]>;

  constructor(userDataPath: string) {
    this.file = new SecureJsonFile(path.join(userDataPath, "account-settings.json"));
  }

  async load(): Promise<void> {
    const parsed = await this.file.read([]);
    if (!Array.isArray(parsed)) {
      return;
    }
    for (const value of parsed) {
      if (isAccountProviderSettings(value)) {
        this.settings.set(value.accountId, { ...value });
      }
    }
  }

  get(accountId: string): AccountProviderSettings {
    const stored = this.settings.get(accountId);
    return stored
      ? { ...stored }
      : {
          accountId,
          defaultBroadcastMode: "standard",
          contextNote: "",
          includeContextInPrompts: false,
          zoomPercent: 100,
          updatedAt: new Date(0).toISOString()
        };
  }

  list(accounts: AccountProfile[]): AccountProviderSettings[] {
    return accounts.map((account) => this.get(account.id));
  }

  async set(settings: AccountProviderSettings): Promise<AccountProviderSettings> {
    this.settings.set(settings.accountId, { ...settings });
    await this.save();
    return { ...settings };
  }

  async remove(accountId: string): Promise<void> {
    if (this.settings.delete(accountId)) {
      await this.save();
    }
  }

  waitForPendingSaves(): Promise<void> {
    return this.file.waitForPendingSaves();
  }

  private save(): Promise<void> {
    return this.file.write([...this.settings.values()]);
  }
}

class PromptHistoryStore {
  private entries: PromptHistoryEntry[] = [];
  private readonly file: SecureJsonFile<PromptHistoryEntry[]>;

  constructor(userDataPath: string) {
    this.file = new SecureJsonFile(path.join(userDataPath, "prompt-history.json"));
  }

  async load(): Promise<void> {
    const parsed = await this.file.read([]);
    this.entries = Array.isArray(parsed) ? parsed.filter(isPromptHistoryEntry).slice(0, 250) : [];
  }

  list(): PromptHistoryEntry[] {
    return this.entries.map((entry) => ({ ...entry, accountIds: [...entry.accountIds] }));
  }

  async record(
    request: Pick<BroadcastRequest, "accountIds" | "prompt" | "mode">,
    source: PromptHistoryEntry["source"]
  ): Promise<void> {
    this.entries.unshift({
      id: randomUUID(),
      accountIds: [...request.accountIds],
      prompt: request.prompt,
      mode: request.mode,
      source,
      createdAt: new Date().toISOString()
    });
    this.entries = this.entries.slice(0, 250);
    await this.file.write(this.entries);
  }

  async clear(): Promise<void> {
    this.entries = [];
    await this.file.write(this.entries);
  }

  waitForPendingSaves(): Promise<void> {
    return this.file.waitForPendingSaves();
  }
}

class PromptTemplateStore {
  private templates: PromptTemplate[] = [];
  private readonly file: SecureJsonFile<PromptTemplate[]>;
  private mutationQueue: Promise<void> = Promise.resolve();

  constructor(userDataPath: string) {
    this.file = new SecureJsonFile(path.join(userDataPath, "prompt-templates.json"));
  }

  async load(): Promise<void> {
    const parsed = await this.file.read([]);
    if (!Array.isArray(parsed)) {
      this.templates = [];
      return;
    }
    const ids = new Set<string>();
    const names = new Set<string>();
    this.templates = parsed.filter((value): value is PromptTemplate => {
      if (!isPromptTemplate(value)) {
        return false;
      }
      const nameKey = templateNameKey(value.name);
      if (ids.has(value.id) || names.has(nameKey)) {
        return false;
      }
      ids.add(value.id);
      names.add(nameKey);
      return true;
    });
  }

  list(): PromptTemplate[] {
    return this.templates.map((template) => ({ ...template }));
  }

  get(id: string): PromptTemplate | undefined {
    const template = this.templates.find((candidate) => candidate.id === id);
    return template ? { ...template } : undefined;
  }

  create(input: PromptTemplateInput): Promise<PromptTemplate> {
    const inputSnapshot = copyPromptTemplateInput(input);
    return this.enqueueMutation(async () => {
      this.assertUniqueName(inputSnapshot.name);
      const now = new Date().toISOString();
      const template: PromptTemplate = {
        id: randomUUID(),
        name: inputSnapshot.name,
        ...(inputSnapshot.category === undefined
          ? {}
          : { category: inputSnapshot.category }),
        ...(inputSnapshot.description === undefined
          ? {}
          : { description: inputSnapshot.description }),
        content: inputSnapshot.content,
        createdAt: now,
        updatedAt: now
      };
      const next = [...this.list(), { ...template }];
      await this.file.write(next);
      this.templates = next;
      return { ...template };
    });
  }

  update(id: string, input: PromptTemplateInput): Promise<PromptTemplate> {
    const inputSnapshot = copyPromptTemplateInput(input);
    return this.enqueueMutation(async () => {
      const index = this.templates.findIndex((template) => template.id === id);
      if (index < 0) {
        throw new Error("Prompt template not found.");
      }
      const existing = this.templates[index];
      if (!existing) {
        throw new Error("Prompt template not found.");
      }
      this.assertUniqueName(inputSnapshot.name, id);
      const template: PromptTemplate = {
        id: existing.id,
        name: inputSnapshot.name,
        ...(inputSnapshot.category === undefined
          ? {}
          : { category: inputSnapshot.category }),
        ...(inputSnapshot.description === undefined
          ? {}
          : { description: inputSnapshot.description }),
        content: inputSnapshot.content,
        createdAt: existing.createdAt,
        updatedAt: new Date().toISOString()
      };
      const next = this.list();
      next[index] = { ...template };
      await this.file.write(next);
      this.templates = next;
      return { ...template };
    });
  }

  delete(id: string): Promise<void> {
    return this.enqueueMutation(async () => {
      const next = this.templates
        .filter((template) => template.id !== id)
        .map((template) => ({ ...template }));
      if (next.length === this.templates.length) {
        throw new Error("Prompt template not found.");
      }
      await this.file.write(next);
      this.templates = next;
    });
  }

  async waitForPendingSaves(): Promise<void> {
    await this.mutationQueue;
    await this.file.waitForPendingSaves();
  }

  private assertUniqueName(name: string, exceptId?: string): void {
    const key = templateNameKey(name);
    if (
      this.templates.some(
        (template) => template.id !== exceptId && templateNameKey(template.name) === key
      )
    ) {
      throw new Error(`A prompt template named "${name}" already exists.`);
    }
  }

  private enqueueMutation<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.mutationQueue.then(operation, operation);
    this.mutationQueue = result.then(
      () => undefined,
      () => undefined
    );
    return result;
  }
}

class ScheduleStore {
  private schedules: ScheduledPrompt[] = [];
  private readonly file: SecureJsonFile<ScheduledPrompt[]>;

  constructor(userDataPath: string) {
    this.file = new SecureJsonFile(path.join(userDataPath, "schedules.json"));
  }

  async load(): Promise<void> {
    const parsed = await this.file.read([]);
    const storedSchedules = Array.isArray(parsed) ? parsed.filter(isStoredScheduledPrompt) : [];
    this.schedules = [];
    let changed = false;
    const now = new Date().toISOString();
    for (const stored of storedSchedules) {
      const schedule = normalizeStoredSchedule(stored);
      this.schedules.push(schedule);
      if (!stored.timeZone || !stored.localTime) {
        changed = true;
      }
      if (schedule.lastOutcome?.status === "running") {
        schedule.lastOutcome = {
          status: "failed",
          completedAt: now,
          message: "The previous run was interrupted when AI Workspace stopped."
        };
        schedule.updatedAt = now;
        changed = true;
      }
    }
    if (changed) {
      await this.save();
    }
  }

  list(): ScheduledPrompt[] {
    return this.schedules.map(copySchedule);
  }

  get(scheduleId: string): ScheduledPrompt | undefined {
    return this.schedules.find((schedule) => schedule.id === scheduleId);
  }

  async create(
    request: CreateScheduleRequest,
    sensitiveDataConsentDigests?: Record<string, string>
  ): Promise<ScheduledPrompt> {
    const now = new Date().toISOString();
    const schedule: ScheduledPrompt = {
      id: randomUUID(),
      accountIds: [...request.accountIds],
      prompt: request.prompt,
      mode: request.mode,
      recurrence: request.recurrence,
      timeZone: request.timeZone,
      localTime: request.localStartAt.slice(11),
      enabled: true,
      nextRunAt: request.firstRunAt,
      allowSensitiveData: request.allowSensitiveData === true,
      ...(sensitiveDataConsentDigests ? { sensitiveDataConsentDigests } : {}),
      createdAt: now,
      updatedAt: now
    };
    this.schedules.push(schedule);
    await this.save();
    return copySchedule(schedule);
  }

  async setEnabled(scheduleId: string, enabled: boolean): Promise<ScheduledPrompt> {
    const schedule = this.get(scheduleId);
    if (!schedule) {
      throw new Error("Schedule not found.");
    }
    if (enabled && !schedule.nextRunAt) {
      throw new Error("A completed one-time schedule cannot be enabled again.");
    }
    schedule.enabled = enabled;
    schedule.updatedAt = new Date().toISOString();
    await this.save();
    return copySchedule(schedule);
  }

  async remove(scheduleId: string): Promise<void> {
    const next = this.schedules.filter((schedule) => schedule.id !== scheduleId);
    if (next.length === this.schedules.length) {
      throw new Error("Schedule not found.");
    }
    this.schedules = next;
    await this.save();
  }

  async removeAccount(accountId: string): Promise<void> {
    let changed = false;
    this.schedules = this.schedules.flatMap((schedule) => {
      if (!schedule.accountIds.includes(accountId)) {
        return [schedule];
      }
      changed = true;
      const accountIds = schedule.accountIds.filter((id) => id !== accountId);
      if (accountIds.length === 0) {
        return [];
      }
      schedule.accountIds = accountIds;
      if (schedule.sensitiveDataConsentDigests) {
        const { [accountId]: _removed, ...remainingDigests } =
          schedule.sensitiveDataConsentDigests;
        schedule.sensitiveDataConsentDigests = remainingDigests;
      }
      schedule.updatedAt = new Date().toISOString();
      return [schedule];
    });
    if (changed) {
      await this.save();
    }
  }

  async claimRun(scheduleId: string, dueAt: string): Promise<ScheduledPrompt | null> {
    const schedule = this.get(scheduleId);
    if (!schedule || !schedule.enabled || schedule.nextRunAt !== dueAt) {
      return null;
    }
    const now = new Date();
    schedule.lastRunAt = now.toISOString();
    schedule.lastOutcome = {
      status: "running",
      completedAt: now.toISOString(),
      message: "Delivery is in progress."
    };
    schedule.nextRunAt = nextScheduledRun(
      dueAt,
      schedule.recurrence,
      now,
      schedule.timeZone,
      schedule.localTime
    );
    if (schedule.recurrence === "once") {
      schedule.enabled = false;
    }
    schedule.updatedAt = now.toISOString();
    await this.save();
    return copySchedule(schedule);
  }

  async completeRun(scheduleId: string, outcome: ScheduleOutcome): Promise<void> {
    const schedule = this.get(scheduleId);
    if (!schedule) {
      return;
    }
    schedule.lastOutcome = outcome;
    schedule.updatedAt = outcome.completedAt;
    await this.save();
  }

  waitForPendingSaves(): Promise<void> {
    return this.file.waitForPendingSaves();
  }

  private save(): Promise<void> {
    return this.file.write(this.schedules);
  }
}

let mainWindow: BrowserWindow | null = null;
let accountStore: AccountStore;
let usageStore: UsageStore;
let preferencesStore: PreferencesStore;
let accountSettingsStore: AccountSettingsStore;
let promptHistoryStore: PromptHistoryStore;
let promptTemplateStore: PromptTemplateStore;
let scheduleStore: ScheduleStore;
let researchStore: ResearchStore;
let geoStudyStore: GeoStudyStore;
let scheduleTimer: NodeJS.Timeout | null = null;
let isRunningSchedules = false;
const retainedComparisonAccountIds = new Set<string>();
let activeAccountId: string | null = null;
let activeUsageStartedAt: number | null = null;
let activeBounds: ViewBounds = { x: 280, y: 56, width: 920, height: 744 };
let isActiveViewVisible = true;
const managedViews = new Map<string, ManagedView>();
const accountDeliveryQueues = new Map<string, Promise<void>>();
const configuredPartitions = new Set<string>();
let isFinalizingQuit = false;
let isQuitRequested = false;
let isRendererCloseConfirmed = false;
let isRendererCloseRequestPending = false;
let isInstallingUpdate = false;
let pendingUpdateInstall:
  | { resolve: () => void; reject: (error: Error) => void }
  | null = null;
let accountSelectionQueue: Promise<void> = Promise.resolve();
const runningGeoStudies = new Map<string, Promise<void>>();
const cancelledGeoStudies = new Set<string>();
let updateStatus: AppUpdateStatus = {
  state: "idle",
  currentVersion: app.getVersion(),
  message: "Ready to check for updates."
};

function requestRendererCloseConfirmation(): void {
  if (
    isRendererCloseRequestPending ||
    !mainWindow ||
    mainWindow.isDestroyed()
  ) {
    return;
  }
  isRendererCloseRequestPending = true;
  mainWindow.webContents.send("app:before-close");
}

function publishUpdateStatus(nextStatus: AppUpdateStatus): AppUpdateStatus {
  updateStatus = nextStatus;
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("updates:status", updateStatus);
  }
  return updateStatus;
}

function updatesAreSupported(): boolean {
  return app.isPackaged && (process.platform !== "linux" || Boolean(process.env.APPIMAGE));
}

function configureAutoUpdater(): void {
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = false;
  autoUpdater.allowPrerelease = preferencesStore.get().updateChannel === "beta";

  if (!updatesAreSupported()) {
    publishUpdateStatus({
      state: "disabled",
      currentVersion: app.getVersion(),
      message: app.isPackaged
        ? "Automatic updates are available for the Linux AppImage. Install other Linux packages from GitHub Releases."
        : "Update checks are available only in packaged builds."
    });
    return;
  }

  autoUpdater.on("checking-for-update", () => {
    publishUpdateStatus({
      state: "checking",
      currentVersion: app.getVersion(),
      message: "Checking GitHub Releases for updates..."
    });
  });
  autoUpdater.on("update-available", (info) => {
    publishUpdateStatus({
      state: "available",
      currentVersion: app.getVersion(),
      availableVersion: info.version,
      message: `AI Workspace ${info.version} is available.`
    });
  });
  autoUpdater.on("update-not-available", () => {
    publishUpdateStatus({
      state: "not-available",
      currentVersion: app.getVersion(),
      message: "You are using the latest available version."
    });
  });
  autoUpdater.on("download-progress", (progress) => {
    publishUpdateStatus({
      state: "downloading",
      currentVersion: app.getVersion(),
      availableVersion: updateStatus.availableVersion,
      downloadPercent: Math.max(0, Math.min(100, Math.round(progress.percent))),
      message: `Downloading update: ${Math.round(progress.percent)}%.`
    });
  });
  autoUpdater.on("update-downloaded", (info) => {
    publishUpdateStatus({
      state: "downloaded",
      currentVersion: app.getVersion(),
      availableVersion: info.version,
      downloadPercent: 100,
      message: `AI Workspace ${info.version} is ready to install.`
    });
  });
  autoUpdater.on("error", (error) => {
    console.error("Unable to update AI Workspace.", error);
    publishUpdateStatus({
      state: "error",
      currentVersion: app.getVersion(),
      availableVersion: updateStatus.availableVersion,
      message: "Unable to check for or download the update. Try again later."
    });
  });
}

async function checkForApplicationUpdates(): Promise<AppUpdateStatus> {
  if (!updatesAreSupported()) {
    return updateStatus;
  }
  if (updateStatus.state === "checking" || updateStatus.state === "downloading") {
    return updateStatus;
  }
  await autoUpdater.checkForUpdates();
  return updateStatus;
}

async function persistApplicationState(reason: string): Promise<void> {
  await stopRunningGeoStudies(reason);
  await flushActiveUsage();
  await Promise.all([
    usageStore.waitForPendingSaves(),
    preferencesStore.waitForPendingSaves(),
    accountSettingsStore.waitForPendingSaves(),
    promptHistoryStore.waitForPendingSaves(),
    promptTemplateStore.waitForPendingSaves(),
    scheduleStore.waitForPendingSaves(),
    researchStore.waitForPendingSaves(),
    geoStudyStore.waitForPendingSaves()
  ]);
}

async function installDownloadedUpdate(): Promise<void> {
  const request = pendingUpdateInstall;
  pendingUpdateInstall = null;
  if (!request) {
    return;
  }

  try {
    await persistApplicationState("AI Workspace is restarting to install an update.");
    isInstallingUpdate = true;
    autoUpdater.quitAndInstall(false, true);
    request.resolve();
  } catch (error) {
    isInstallingUpdate = false;
    isRendererCloseConfirmed = false;
    request.reject(
      error instanceof Error ? error : new Error("Unable to start the update installer.")
    );
    return;
  }

  const installFallbackTimer = setTimeout(() => {
    isInstallingUpdate = false;
    isRendererCloseConfirmed = false;
    publishUpdateStatus({
      ...updateStatus,
      state: "error",
      message: "The installer did not start. Restart AI Workspace and try again."
    });
  }, 10_000);
  installFallbackTimer.unref();
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}

function isAccountProfile(value: unknown): value is AccountProfile {
  if (!value || typeof value !== "object") {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.id === "string" &&
    isServiceId(candidate.serviceId) &&
    typeof candidate.label === "string" &&
    typeof candidate.createdAt === "string" &&
    typeof candidate.lastUsedAt === "string"
  );
}

function isUsageRecord(value: unknown): value is UsageRecord {
  if (!value || typeof value !== "object") {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.date === "string" &&
    typeof candidate.accountId === "string" &&
    isServiceId(candidate.serviceId) &&
    typeof candidate.activeMs === "number" &&
    Number.isFinite(candidate.activeMs) &&
    candidate.activeMs >= 0 &&
    typeof candidate.opens === "number" &&
    Number.isInteger(candidate.opens) &&
    candidate.opens >= 0 &&
    typeof candidate.switches === "number" &&
    Number.isInteger(candidate.switches) &&
    candidate.switches >= 0
  );
}

function isIsoDate(value: unknown): value is string {
  return (
    typeof value === "string" &&
    Number.isFinite(Date.parse(value)) &&
    new Date(value).toISOString() === value
  );
}

function isUuid(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value
    )
  );
}

function templateNameKey(name: string): string {
  return name.normalize("NFKC").toLowerCase();
}

function copyPromptTemplateInput(input: PromptTemplateInput): PromptTemplateInput {
  return {
    name: input.name,
    ...(input.category === undefined ? {} : { category: input.category }),
    ...(input.description === undefined ? {} : { description: input.description }),
    content: input.content
  };
}

function isPromptTemplate(value: unknown): value is PromptTemplate {
  if (!value || typeof value !== "object") {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  return (
    isUuid(candidate.id) &&
    typeof candidate.name === "string" &&
    candidate.name === candidate.name.trim() &&
    candidate.name.length >= 1 &&
    candidate.name.length <= 80 &&
    (candidate.category === undefined ||
      (typeof candidate.category === "string" &&
        candidate.category === candidate.category.trim() &&
        candidate.category.length >= 1 &&
        candidate.category.length <= 80)) &&
    (candidate.description === undefined ||
      (typeof candidate.description === "string" &&
        candidate.description === candidate.description.trim() &&
        candidate.description.length >= 1 &&
        candidate.description.length <= 500)) &&
    typeof candidate.content === "string" &&
    candidate.content.trim().length >= 1 &&
    candidate.content.length <= 12_000 &&
    isIsoDate(candidate.createdAt) &&
    isIsoDate(candidate.updatedAt)
  );
}

function normalizePromptTemplateInput(value: unknown): PromptTemplateInput | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const candidate = value as Record<string, unknown>;
  if (
    typeof candidate.name !== "string" ||
    typeof candidate.content !== "string" ||
    (candidate.category !== undefined && typeof candidate.category !== "string") ||
    (candidate.description !== undefined && typeof candidate.description !== "string")
  ) {
    return null;
  }
  const name = candidate.name.trim();
  const category = candidate.category?.trim();
  const description = candidate.description?.trim();
  if (
    name.length < 1 ||
    name.length > 80 ||
    (category !== undefined && category.length > 80) ||
    (description !== undefined && description.length > 500) ||
    candidate.content.trim().length < 1 ||
    candidate.content.length > 12_000
  ) {
    return null;
  }
  return {
    name,
    ...(category ? { category } : {}),
    ...(description ? { description } : {}),
    content: candidate.content
  };
}

function normalizePreferences(value: unknown): AppPreferences | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const candidate = value as Record<string, unknown>;
  const protection = normalizeDataProtectionSettings(candidate.dataProtectionByService);
  const appZoomPercent =
    candidate.appZoomPercent === undefined ? 100 : candidate.appZoomPercent;
  const updateChannel =
    candidate.updateChannel === undefined ? "stable" : candidate.updateChannel;
  if (
    (candidate.theme !== "light" &&
      candidate.theme !== "dark" &&
      candidate.theme !== "system") ||
    (candidate.textSize !== "standard" &&
      candidate.textSize !== "large" &&
      candidate.textSize !== "extra-large") ||
    typeof appZoomPercent !== "number" ||
    !APP_ZOOM_LEVELS.includes(appZoomPercent as (typeof APP_ZOOM_LEVELS)[number]) ||
    typeof candidate.highContrast !== "boolean" ||
    typeof candidate.reducedMotion !== "boolean" ||
    (updateChannel !== "stable" && updateChannel !== "beta") ||
    !protection
  ) {
    return null;
  }
  return {
    theme: candidate.theme,
    textSize: candidate.textSize,
    appZoomPercent,
    highContrast: candidate.highContrast,
    reducedMotion: candidate.reducedMotion,
    updateChannel,
    dataProtectionByService: protection
  };
}

function isAccountProviderSettings(value: unknown): value is AccountProviderSettings {
  if (!value || typeof value !== "object") {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.accountId === "string" &&
    isBroadcastMode(candidate.defaultBroadcastMode) &&
    typeof candidate.contextNote === "string" &&
    candidate.contextNote.length <= 4_000 &&
    typeof candidate.includeContextInPrompts === "boolean" &&
    typeof candidate.zoomPercent === "number" &&
    Number.isInteger(candidate.zoomPercent) &&
    candidate.zoomPercent >= 75 &&
    candidate.zoomPercent <= 200 &&
    isIsoDate(candidate.updatedAt)
  );
}

function isPromptHistoryEntry(value: unknown): value is PromptHistoryEntry {
  if (!value || typeof value !== "object") {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.id === "string" &&
    Array.isArray(candidate.accountIds) &&
    candidate.accountIds.length >= 1 &&
    candidate.accountIds.length <= 8 &&
    candidate.accountIds.every((id) => typeof id === "string") &&
    typeof candidate.prompt === "string" &&
    candidate.prompt.length >= 1 &&
    candidate.prompt.length <= 12_000 &&
    isBroadcastMode(candidate.mode) &&
    (candidate.source === "broadcast" || candidate.source === "schedule") &&
    isIsoDate(candidate.createdAt)
  );
}

function isScheduleRecurrence(value: unknown): value is ScheduleRecurrence {
  return value === "once" || value === "daily" || value === "weekly";
}

function isScheduleOutcome(value: unknown): value is ScheduleOutcome {
  if (!value || typeof value !== "object") {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  return (
    (candidate.status === "running" ||
      candidate.status === "success" ||
      candidate.status === "partial" ||
      candidate.status === "failed") &&
    isIsoDate(candidate.completedAt) &&
    typeof candidate.message === "string" &&
    candidate.message.length <= 500
  );
}

function isValidTimeZone(value: unknown): value is string {
  if (typeof value !== "string" || value.length > 100) {
    return false;
  }
  try {
    new Intl.DateTimeFormat("en", { timeZone: value }).format();
    return true;
  } catch {
    return false;
  }
}

function isLocalTime(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d{1,3})?)?$/.test(value)
  );
}

function isStoredScheduledPrompt(value: unknown): value is StoredScheduledPrompt {
  if (!value || typeof value !== "object") {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  const consentDigests = candidate.sensitiveDataConsentDigests;
  const hasValidConsentDigests =
    consentDigests === undefined ||
    (consentDigests !== null &&
      typeof consentDigests === "object" &&
      !Array.isArray(consentDigests) &&
      Object.entries(consentDigests).every(
        ([accountId, digest]) =>
          accountId.length > 0 &&
          typeof digest === "string" &&
          /^[a-f0-9]{64}$/.test(digest)
      ));
  return (
    typeof candidate.id === "string" &&
    Array.isArray(candidate.accountIds) &&
    candidate.accountIds.length >= 1 &&
    candidate.accountIds.length <= 8 &&
    candidate.accountIds.every((id) => typeof id === "string") &&
    typeof candidate.prompt === "string" &&
    candidate.prompt.length >= 1 &&
    candidate.prompt.length <= 12_000 &&
    isBroadcastMode(candidate.mode) &&
    isScheduleRecurrence(candidate.recurrence) &&
    typeof candidate.enabled === "boolean" &&
    (candidate.nextRunAt === null || isIsoDate(candidate.nextRunAt)) &&
    (candidate.lastRunAt === undefined || isIsoDate(candidate.lastRunAt)) &&
    (candidate.lastOutcome === undefined || isScheduleOutcome(candidate.lastOutcome)) &&
    typeof candidate.allowSensitiveData === "boolean" &&
    hasValidConsentDigests &&
    (candidate.timeZone === undefined || isValidTimeZone(candidate.timeZone)) &&
    (candidate.localTime === undefined || isLocalTime(candidate.localTime)) &&
    isIsoDate(candidate.createdAt) &&
    isIsoDate(candidate.updatedAt)
  );
}

interface LocalDateTimeParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  millisecond: number;
}

const zonedDateTimeFormatters = new Map<string, Intl.DateTimeFormat>();

function localPartsAt(date: Date, timeZone: string): LocalDateTimeParts {
  let formatter = zonedDateTimeFormatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      calendar: "iso8601",
      numberingSystem: "latn",
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    });
    zonedDateTimeFormatters.set(timeZone, formatter);
  }
  const formattedParts = formatter.formatToParts(date);
  const valueOf = (type: Intl.DateTimeFormatPartTypes): number =>
    Number(formattedParts.find((part) => part.type === type)?.value);
  return {
    year: valueOf("year"),
    month: valueOf("month"),
    day: valueOf("day"),
    hour: valueOf("hour"),
    minute: valueOf("minute"),
    second: valueOf("second"),
    millisecond: date.getUTCMilliseconds()
  };
}

function localWallClockValue(parts: LocalDateTimeParts): number {
  return Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
    parts.millisecond
  );
}

function timeZoneOffsetAt(instant: Date, timeZone: string): number {
  const parts = localPartsAt(instant, timeZone);
  const instantWithoutMilliseconds =
    Math.floor(instant.getTime() / 1_000) * 1_000 + parts.millisecond;
  return localWallClockValue(parts) - instantWithoutMilliseconds;
}

function dateAtLocalWallClock(parts: LocalDateTimeParts, timeZone: string): Date {
  const wallClock = localWallClockValue(parts);
  const offsets = new Set<number>();
  for (let hours = -48; hours <= 48; hours += 6) {
    offsets.add(timeZoneOffsetAt(new Date(wallClock + hours * 3_600_000), timeZone));
  }
  const candidates = [...offsets]
    .map((offset) => new Date(wallClock - offset))
    .map((date) => ({ date, localValue: localWallClockValue(localPartsAt(date, timeZone)) }))
    .sort((left, right) => left.date.getTime() - right.date.getTime());
  const exact = candidates.find((candidate) => candidate.localValue === wallClock);
  if (exact) {
    return exact.date;
  }
  const compatible = candidates
    .filter((candidate) => candidate.localValue > wallClock)
    .sort((left, right) => left.localValue - right.localValue)[0];
  return compatible?.date ?? new Date(wallClock);
}

function localTimeForDate(date: Date, timeZone: string): string {
  const parts = localPartsAt(date, timeZone);
  const pad = (value: number, width = 2) => value.toString().padStart(width, "0");
  return `${pad(parts.hour)}:${pad(parts.minute)}:${pad(parts.second)}.${pad(
    parts.millisecond,
    3
  )}`;
}

function normalizeStoredSchedule(schedule: StoredScheduledPrompt): ScheduledPrompt {
  const timeZone =
    schedule.timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone ?? "UTC";
  const reference = new Date(schedule.nextRunAt ?? schedule.lastRunAt ?? schedule.createdAt);
  return {
    ...schedule,
    timeZone,
    localTime: schedule.localTime ?? localTimeForDate(reference, timeZone)
  };
}

function copySchedule(schedule: ScheduledPrompt): ScheduledPrompt {
  return {
    ...schedule,
    accountIds: [...schedule.accountIds],
    ...(schedule.sensitiveDataConsentDigests
      ? { sensitiveDataConsentDigests: { ...schedule.sensitiveDataConsentDigests } }
      : {}),
    ...(schedule.lastOutcome ? { lastOutcome: { ...schedule.lastOutcome } } : {})
  };
}

function nextScheduledRun(
  dueAt: string,
  recurrence: ScheduleRecurrence,
  now: Date,
  timeZone: string,
  localTime: string
): string | null {
  if (recurrence === "once") {
    return null;
  }
  const dueLocal = localPartsAt(new Date(dueAt), timeZone);
  const [time = "00:00", fraction = ""] = localTime.split(".");
  const timeParts = time.split(":");
  const hour = Number(timeParts[0] ?? 0);
  const minute = Number(timeParts[1] ?? 0);
  const second = Number(timeParts[2] ?? 0);
  const millisecond = Number(fraction.padEnd(3, "0"));
  const dayStep = recurrence === "daily" ? 1 : 7;
  const cursor = new Date(Date.UTC(dueLocal.year, dueLocal.month - 1, dueLocal.day));
  while (true) {
    cursor.setUTCDate(cursor.getUTCDate() + dayStep);
    const next = dateAtLocalWallClock(
      {
        year: cursor.getUTCFullYear(),
        month: cursor.getUTCMonth() + 1,
        day: cursor.getUTCDate(),
        hour,
        minute,
        second,
        millisecond
      },
      timeZone
    );
    if (next.getTime() > now.getTime()) {
      return next.toISOString();
    }
  }
}

function isUsagePeriodDays(value: unknown): value is UsagePeriodDays {
  return value === 7 || value === 30;
}

function usageDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function usageCutoff(periodDays: UsagePeriodDays): string {
  const cutoff = new Date();
  cutoff.setUTCHours(0, 0, 0, 0);
  cutoff.setUTCDate(cutoff.getUTCDate() - (periodDays - 1));
  return usageDate(cutoff);
}

function compareCsvText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function csvField(value: CsvValue): string {
  let text = String(value);
  if (typeof value === "string" && /^[=+\-@\t\r]/.test(text)) {
    text = `'${text}`;
  }
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function createUsageCsv(
  periodDays: UsagePeriodDays,
  records: UsageRecord[],
  accounts: AccountProfile[]
): { content: string; rowCount: number } {
  const periodStart = usageCutoff(periodDays);
  const periodEnd = usageDate(new Date());
  const accountLabels = new Map(accounts.map((account) => [account.id, account.label]));
  const providerTotals = new Map<ServiceId, ServiceUsageSummary>(
    SERVICES.map((service) => [
      service.id,
      { serviceId: service.id, activeMs: 0, opens: 0, switches: 0 }
    ])
  );
  const sortedRecords = records.sort((left, right) => {
    const leftLabel = accountLabels.get(left.accountId) ?? "Removed account";
    const rightLabel = accountLabels.get(right.accountId) ?? "Removed account";
    return (
      compareCsvText(left.date, right.date) ||
      compareCsvText(leftLabel, rightLabel) ||
      compareCsvText(left.accountId, right.accountId) ||
      compareCsvText(left.serviceId, right.serviceId)
    );
  });
  const rows: CsvValue[][] = [];

  for (const record of sortedRecords) {
    const totals = providerTotals.get(record.serviceId);
    if (totals) {
      totals.activeMs += record.activeMs;
      totals.opens += record.opens;
      totals.switches += record.switches;
    }
    rows.push([
      "detail",
      record.date,
      record.accountId,
      accountLabels.get(record.accountId) ?? "Removed account",
      record.serviceId,
      SERVICE_BY_ID.get(record.serviceId)?.name ?? record.serviceId,
      record.activeMs,
      record.opens,
      record.switches,
      periodDays,
      periodStart,
      periodEnd
    ]);
  }

  const sortedProviderTotals = [...providerTotals.values()].sort((left, right) =>
    compareCsvText(left.serviceId, right.serviceId)
  );
  for (const totals of sortedProviderTotals) {
    rows.push([
      "provider_total",
      "",
      "",
      "",
      totals.serviceId,
      SERVICE_BY_ID.get(totals.serviceId)?.name ?? totals.serviceId,
      totals.activeMs,
      totals.opens,
      totals.switches,
      periodDays,
      periodStart,
      periodEnd
    ]);
  }

  rows.push([
    "grand_total",
    "",
    "",
    "",
    "",
    "",
    sortedProviderTotals.reduce((sum, totals) => sum + totals.activeMs, 0),
    sortedProviderTotals.reduce((sum, totals) => sum + totals.opens, 0),
    sortedProviderTotals.reduce((sum, totals) => sum + totals.switches, 0),
    periodDays,
    periodStart,
    periodEnd
  ]);

  const header = [
    "row_type",
    "date",
    "account_id",
    "account_label",
    "provider_id",
    "provider_name",
    "active_ms",
    "opens",
    "switches",
    "period_days",
    "period_start",
    "period_end"
  ];
  const lines = [header, ...rows].map((row) => row.map(csvField).join(","));
  return { content: `\uFEFF${lines.join("\r\n")}\r\n`, rowCount: rows.length };
}

function shouldTrackActiveUsage(): boolean {
  return Boolean(
    mainWindow?.isFocused() &&
      isActiveViewVisible &&
      activeAccountId &&
      accountStore.get(activeAccountId)
  );
}

function beginActiveUsage(): void {
  if (activeUsageStartedAt === null && shouldTrackActiveUsage()) {
    activeUsageStartedAt = Date.now();
  }
}

async function flushActiveUsage(): Promise<void> {
  if (activeUsageStartedAt === null) {
    return;
  }

  const startedAt = activeUsageStartedAt;
  activeUsageStartedAt = null;
  const account = activeAccountId ? accountStore.get(activeAccountId) : undefined;
  if (account) {
    await usageStore.recordActive(account, Date.now() - startedAt);
  }
}

function hostMatches(hostname: string, trustedHost: string): boolean {
  return hostname === trustedHost || hostname.endsWith(`.${trustedHost}`);
}

function isTrustedUrl(serviceId: ServiceId, rawUrl: string, includeAuth = true): boolean {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return false;
  }

  if (url.protocol !== "https:") {
    return false;
  }

  const service = SERVICE_BY_ID.get(serviceId);
  if (!service) {
    return false;
  }

  const allowedHosts = includeAuth
    ? [...service.trustedHosts, ...AUTH_HOSTS_BY_SERVICE[serviceId]]
    : service.trustedHosts;
  return allowedHosts.some((host) => hostMatches(url.hostname, host));
}

function openExternalHttps(rawUrl: string): void {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    console.warn("Blocked malformed external URL.");
    return;
  }

  if (url.protocol !== "https:") {
    console.warn(`Blocked external protocol: ${url.protocol}`);
    return;
  }

  void shell.openExternal(url.toString()).catch((error: unknown) => {
    console.error("Unable to open external URL.", error);
  });
}

function partitionFor(account: AccountProfile): string {
  return `persist:ai-workspace-${account.serviceId}-${account.id}`;
}

function configurePartition(partition: string, serviceId: ServiceId): void {
  if (configuredPartitions.has(partition)) {
    return;
  }
  const isolatedSession = session.fromPartition(partition);
  const allowedPermissions = new Set(["notifications", "clipboard-read"]);

  isolatedSession.setPermissionCheckHandler((_webContents, permission, requestingOrigin) => {
    return (
      allowedPermissions.has(permission) &&
      isTrustedUrl(serviceId, requestingOrigin, false)
    );
  });

  isolatedSession.setPermissionRequestHandler(
    (_webContents, permission, callback, details) => {
      callback(
        allowedPermissions.has(permission) &&
          isTrustedUrl(serviceId, details.requestingUrl, false)
      );
    }
  );

  configuredPartitions.add(partition);
}

function emitViewState(managedView: ManagedView, error?: string): void {
  if (!mainWindow || mainWindow.isDestroyed() || activeAccountId !== managedView.accountId) {
    return;
  }

  const contents = managedView.view.webContents;
  if (contents.isDestroyed()) {
    return;
  }

  const state: ViewState = {
    accountId: managedView.accountId,
    url: contents.getURL(),
    title: contents.getTitle(),
    isLoading: contents.isLoading(),
    canGoBack: contents.navigationHistory.canGoBack(),
    canGoForward: contents.navigationHistory.canGoForward(),
    ...(error ? { error } : {})
  };
  mainWindow.webContents.send("views:state", state);
}

function attachNavigationGuards(managedView: ManagedView): void {
  const contents = managedView.view.webContents;

  contents.on("will-navigate", (event, url) => {
    if (!isTrustedUrl(managedView.serviceId, url)) {
      event.preventDefault();
      openExternalHttps(url);
    }
  });

  contents.on("will-redirect", (event, url) => {
    if (!isTrustedUrl(managedView.serviceId, url)) {
      event.preventDefault();
      openExternalHttps(url);
    }
  });

  contents.setWindowOpenHandler(({ url }) => {
    if (!isTrustedUrl(managedView.serviceId, url)) {
      openExternalHttps(url);
      return { action: "deny" };
    }

    return {
      action: "allow",
      overrideBrowserWindowOptions: {
        parent: mainWindow ?? undefined,
        width: 520,
        height: 720,
        autoHideMenuBar: true,
        webPreferences: {
          partition: managedView.partition,
          contextIsolation: true,
          nodeIntegration: false,
          sandbox: true,
          webSecurity: true
        }
      }
    };
  });
  contents.on("did-create-window", (childWindow) => {
    attachPopupNavigationGuards(childWindow.webContents, managedView);
  });

  contents.on("did-start-loading", () => emitViewState(managedView));
  contents.on("did-stop-loading", () => emitViewState(managedView));
  contents.on("did-navigate", () => emitViewState(managedView));
  contents.on("did-navigate-in-page", () => emitViewState(managedView));
  contents.on("page-title-updated", () => emitViewState(managedView));
  contents.on("did-fail-load", (_event, errorCode, errorDescription, _url, isMainFrame) => {
    if (isMainFrame && errorCode !== -3) {
      emitViewState(managedView, errorDescription);
    }
  });
  contents.on("render-process-gone", (_event, details) => {
    emitViewState(managedView, `The page process stopped: ${details.reason}.`);
  });
}

function attachPopupNavigationGuards(
  contents: Electron.WebContents,
  managedView: ManagedView
): void {
  contents.on("will-navigate", (event, url) => {
    if (!isTrustedUrl(managedView.serviceId, url)) {
      event.preventDefault();
      openExternalHttps(url);
    }
  });

  contents.on("will-redirect", (event, url) => {
    if (!isTrustedUrl(managedView.serviceId, url)) {
      event.preventDefault();
      openExternalHttps(url);
    }
  });

  contents.setWindowOpenHandler(({ url }) => {
    if (!isTrustedUrl(managedView.serviceId, url)) {
      openExternalHttps(url);
      return { action: "deny" };
    }

    return {
      action: "allow",
      overrideBrowserWindowOptions: {
        parent: mainWindow ?? undefined,
        width: 520,
        height: 720,
        autoHideMenuBar: true,
        webPreferences: {
          partition: managedView.partition,
          contextIsolation: true,
          nodeIntegration: false,
          sandbox: true,
          webSecurity: true
        }
      }
    };
  });
  contents.on("did-create-window", (childWindow) => {
    attachPopupNavigationGuards(childWindow.webContents, managedView);
  });
}

function createManagedView(account: AccountProfile): ManagedView {
  const partition = partitionFor(account);
  configurePartition(partition, account.serviceId);

  const view = new WebContentsView({
    webPreferences: {
      partition,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      spellcheck: true
    }
  });

  const managedView: ManagedView = {
    accountId: account.id,
    serviceId: account.serviceId,
    partition,
    view,
    lastActivatedAt: Date.now(),
    attached: false
  };
  view.webContents.setZoomFactor(accountSettingsStore.get(account.id).zoomPercent / 100);
  attachNavigationGuards(managedView);
  view.webContents.on("before-input-event", (event, input) => {
    if (handleApplicationZoomShortcut(event, input)) {
      return;
    }
    const commandModifier = process.platform === "darwin" ? input.meta : input.control;
    const otherCommandModifier =
      process.platform === "darwin" ? input.control : input.meta;
    if (
      input.type !== "keyDown" ||
      input.isAutoRepeat ||
      !commandModifier ||
      otherCommandModifier ||
      input.alt ||
      input.shift ||
      !/^[1-8]$/.test(input.key)
    ) {
      return;
    }
    const service = SERVICES[Number(input.key) - 1];
    if (
      !service ||
      !accountStore.list().some((candidate) => candidate.serviceId === service.id) ||
      !mainWindow ||
      mainWindow.isDestroyed()
    ) {
      return;
    }
    event.preventDefault();
    mainWindow.webContents.send("shortcuts:provider", service.id);
  });
  view.webContents.on("did-finish-load", () => {
    void applyDataProtectionToView(managedView).catch((error: unknown) => {
      console.error(`Unable to apply data protection to ${account.serviceId}.`, error);
    });
  });

  const service = SERVICE_BY_ID.get(account.serviceId);
  if (!service) {
    throw new Error("Unsupported service.");
  }
  void view.webContents.loadURL(service.homeUrl);
  return managedView;
}

function handleApplicationZoomShortcut(
  event: { preventDefault(): void },
  input: Input
): boolean {
  const commandModifier = process.platform === "darwin" ? input.meta : input.control;
  const otherCommandModifier =
    process.platform === "darwin" ? input.control : input.meta;
  if (
    input.type !== "keyDown" ||
    input.isAutoRepeat ||
    !commandModifier ||
    otherCommandModifier ||
    input.alt
  ) {
    return false;
  }

  const zoomAction =
    input.code === "Equal" || input.code === "NumpadAdd" || input.key === "+"
      ? "in"
      : input.code === "Minus" || input.code === "NumpadSubtract" || input.key === "-"
        ? "out"
        : input.code === "Digit0" || input.code === "Numpad0" || input.key === "0"
          ? "reset"
          : null;
  if (!zoomAction) {
    return false;
  }

  event.preventDefault();
  void updateApplicationZoom(zoomAction).catch((error: unknown) => {
    console.error("Unable to update application zoom.", error);
  });
  return true;
}

async function updateApplicationZoom(action: "in" | "out" | "reset"): Promise<void> {
  const current = preferencesStore.get();
  const storedIndex = APP_ZOOM_LEVELS.indexOf(
    current.appZoomPercent as (typeof APP_ZOOM_LEVELS)[number]
  );
  const currentIndex = storedIndex >= 0 ? storedIndex : APP_ZOOM_LEVELS.indexOf(100);
  const nextIndex =
    action === "reset"
      ? APP_ZOOM_LEVELS.indexOf(100)
      : Math.min(
          APP_ZOOM_LEVELS.length - 1,
          Math.max(0, currentIndex + (action === "in" ? 1 : -1))
        );
  const appZoomPercent = APP_ZOOM_LEVELS[nextIndex] ?? 100;
  if (appZoomPercent === current.appZoomPercent) {
    return;
  }

  const preferences = await preferencesStore.set({ ...current, appZoomPercent });
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.setZoomFactor(appZoomPercent / 100);
    mainWindow.webContents.send("preferences:changed", preferences);
  }
}

function normalizeDataProtectionSettings(value: unknown): DataProtectionSettings | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const candidate = value as Record<string, unknown>;
  const normalized = { ...DEFAULT_DATA_PROTECTION_SETTINGS };
  for (const serviceId of Object.keys(DEFAULT_DATA_PROTECTION_SETTINGS) as ServiceId[]) {
    if (typeof candidate[serviceId] !== "boolean") {
      return null;
    }
    normalized[serviceId] = candidate[serviceId];
  }
  return normalized;
}

function buildDataProtectionScript(
  adapter: BroadcastAdapter,
  serviceName: string,
  enabled: boolean
): string {
  const payload = JSON.stringify({ adapter, serviceName, enabled });
  const scannerSource = scanSensitiveData.toString();
  return `
    (() => {
      window.__aiWorkspaceDataProtectionCleanup?.();
      const { adapter, serviceName, enabled } = ${payload};
      if (!enabled) {
        delete window.__aiWorkspaceDataProtectionCleanup;
        return;
      }
      const scan = ${scannerSource};
      const visibleComposer = () => {
        for (const selector of adapter.composerSelectors) {
          const composer = [...document.querySelectorAll(selector)].find((element) => {
            const bounds = element.getBoundingClientRect();
            return bounds.width > 0 && bounds.height > 0;
          });
          if (composer) return composer;
        }
        return null;
      };
      const readComposer = (composer) =>
        composer instanceof HTMLTextAreaElement || composer instanceof HTMLInputElement
          ? composer.value
          : composer.innerText || composer.textContent || "";
      const shouldReview = () => {
        const composer = visibleComposer();
        if (!composer) return false;
        const findings = scan(readComposer(composer));
        if (findings.length === 0) return false;
        const labels = [...new Set(findings.map((finding) => finding.label))];
        return !window.confirm(
          "Sensitive data warning\\n\\n" +
          "AI Workspace detected: " + labels.join(", ") + ".\\n\\n" +
          "This check ran locally. Sending to " + serviceName +
          " may expose personal or company information.\\n\\nSend anyway?"
        );
      };
      const matchesSendControl = (target) =>
        target instanceof Element &&
        adapter.sendSelectors.some((selector) => target.closest(selector));
      const onClick = (event) => {
        if (event.isTrusted && matchesSendControl(event.target) && shouldReview()) {
          event.preventDefault();
          event.stopImmediatePropagation();
        }
      };
      const onKeyDown = (event) => {
        if (!event.isTrusted || event.key !== "Enter" || event.shiftKey || event.isComposing) return;
        const composer = visibleComposer();
        if (
          composer &&
          (event.target === composer || (event.target instanceof Node && composer.contains(event.target))) &&
          shouldReview()
        ) {
          event.preventDefault();
          event.stopImmediatePropagation();
        }
      };
      document.addEventListener("click", onClick, true);
      document.addEventListener("keydown", onKeyDown, true);
      window.__aiWorkspaceDataProtectionCleanup = () => {
        document.removeEventListener("click", onClick, true);
        document.removeEventListener("keydown", onKeyDown, true);
      };
    })()
  `;
}

async function applyDataProtectionToView(managedView: ManagedView): Promise<void> {
  if (managedView.view.webContents.isDestroyed()) {
    return;
  }
  const service = SERVICE_BY_ID.get(managedView.serviceId);
  if (!service) {
    throw new Error("Unsupported service.");
  }
  await managedView.view.webContents.executeJavaScript(
    buildDataProtectionScript(
      BROADCAST_ADAPTERS[managedView.serviceId],
      service.name,
      dataProtectionSettings[managedView.serviceId]
    ),
    true
  );
}

function isBroadcastMode(value: unknown): value is BroadcastMode {
  return value === "standard" || value === "deep-research";
}

function normalizeBroadcastRequest(value: unknown): BroadcastRequest | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate = value as Record<string, unknown>;
  if (
    !Array.isArray(candidate.accountIds) ||
    candidate.accountIds.length < 1 ||
    candidate.accountIds.length > 8 ||
    !candidate.accountIds.every((accountId) => typeof accountId === "string") ||
    typeof candidate.prompt !== "string" ||
    !isBroadcastMode(candidate.mode) ||
    (candidate.allowSensitiveData !== undefined &&
      typeof candidate.allowSensitiveData !== "boolean")
  ) {
    return null;
  }
  const prompt = candidate.prompt;
  const accountIds = [...new Set(candidate.accountIds)];
  if (prompt.trim().length < 1 || prompt.length > 12_000 || accountIds.length < 1) {
    return null;
  }
  return {
    accountIds,
    prompt,
    mode: candidate.mode,
    allowSensitiveData: candidate.allowSensitiveData === true
  };
}

function normalizeResearchBroadcastRequest(value: unknown): BroadcastRequest | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const candidate = value as Record<string, unknown>;
  if (
    !Array.isArray(candidate.accountIds) ||
    !candidate.accountIds.every((accountId) => typeof accountId === "string") ||
    typeof candidate.prompt !== "string" ||
    !isBroadcastMode(candidate.mode) ||
    (candidate.allowSensitiveData !== undefined &&
      typeof candidate.allowSensitiveData !== "boolean")
  ) {
    return null;
  }
  const accountIds = [...new Set(candidate.accountIds)];
  if (
    accountIds.length < 1 ||
    accountIds.length > 8 ||
    !candidate.prompt.trim() ||
    candidate.prompt.length > MAX_RESEARCH_OPTIMIZATION_PROMPT_LENGTH
  ) {
    return null;
  }
  return {
    accountIds,
    prompt: candidate.prompt,
    mode: candidate.mode,
    allowSensitiveData: candidate.allowSensitiveData === true
  };
}

function promptForAccount(accountId: string, prompt: string): string {
  const settings = accountSettingsStore.get(accountId);
  if (!settings.includeContextInPrompts || !settings.contextNote.trim()) {
    return prompt;
  }
  return `[Saved context]\n${settings.contextNote.trim()}\n\n[Prompt]\n${prompt}`;
}

function effectivePayloadDigest(accountId: string, prompt: string): string {
  return createHash("sha256")
    .update(JSON.stringify({ accountId, prompt }))
    .digest("hex");
}

function consentDigestsForRequest(request: BroadcastRequest): Record<string, string> {
  return Object.fromEntries(
    request.accountIds.map((accountId) => [
      accountId,
      effectivePayloadDigest(accountId, promptForAccount(accountId, request.prompt))
    ])
  );
}

function waitForViewReady(managedView: ManagedView): Promise<void> {
  const contents = managedView.view.webContents;
  if (!contents.isLoading()) {
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error("The provider took too long to load."));
    }, 20_000);
    const cleanup = () => {
      clearTimeout(timeout);
      contents.removeListener("did-finish-load", handleFinish);
      contents.removeListener("did-fail-load", handleFailure);
    };
    const handleFinish = () => {
      cleanup();
      resolve();
    };
    const handleFailure = (
      _event: Electron.Event,
      errorCode: number,
      errorDescription: string,
      _validatedUrl: string,
      isMainFrame: boolean
    ) => {
      if (!isMainFrame || errorCode === -3) {
        return;
      }
      cleanup();
      reject(new Error(errorDescription || "The provider page could not load."));
    };
    contents.once("did-finish-load", handleFinish);
    contents.on("did-fail-load", handleFailure);
  });
}

function buildBroadcastScript(
  adapter: BroadcastAdapter,
  prompt: string,
  mode: BroadcastMode,
  protectDraft: boolean,
  cancelOnGeoPause = false
): string {
  const payload = JSON.stringify({
    adapter,
    prompt,
    mode,
    protectDraft,
    cancelOnGeoPause
  });
  return `
    (async () => {
      const { adapter, prompt, mode, protectDraft, cancelOnGeoPause } = ${payload};
      const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
      const visible = (element) => {
        const bounds = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return bounds.width > 0 && bounds.height > 0 && style.visibility !== "hidden";
      };
      const findByLabels = (labels, root = document) => {
        const candidates = [...root.querySelectorAll("button, [role='button'], [role='menuitem']")]
          .filter(visible);
        return candidates.find((element) => {
          const text = (element.getAttribute("aria-label") || element.textContent || "")
            .trim()
            .toLowerCase();
          return labels.some((label) =>
            label.includes("deep") ? text.includes(label) : text === label
          );
        });
      };
      const findComposer = () => {
        for (const selector of adapter.composerSelectors) {
          const candidate = [...document.querySelectorAll(selector)].find(visible);
          if (candidate) return candidate;
        }
        return null;
      };
      const composer = findComposer();
      if (!composer) {
        return {
          status: "failed",
          message: "Open this account and complete sign-in before broadcasting."
        };
      }
      const composerText =
        composer instanceof HTMLTextAreaElement || composer instanceof HTMLInputElement
          ? composer.value
          : composer.innerText || composer.textContent || "";
      if (protectDraft && composerText.trim().length > 0) {
        return {
          status: "failed",
          message: "Automated delivery deferred because this account has a non-empty draft."
        };
      }
      if (mode === "deep-research") {
        const controlRoot =
          composer.closest("form") ||
          composer.closest("[class*='composer']") ||
          composer.parentElement?.parentElement ||
          document;
        let researchControl = findByLabels(adapter.deepResearchLabels, controlRoot);
        if (!researchControl) {
          const opener = findByLabels(adapter.deepResearchOpeners, controlRoot);
          if (opener) {
            opener.click();
            await pause(350);
            researchControl = findByLabels(adapter.deepResearchLabels);
          }
        }
        if (!researchControl) {
          return {
            status: "unsupported",
            message: "Deep Research is not available in this account or current provider interface."
          };
        }
        const selected =
          researchControl.getAttribute("aria-pressed") === "true" ||
          researchControl.getAttribute("aria-selected") === "true" ||
          researchControl.getAttribute("aria-checked") === "true" ||
          researchControl.getAttribute("data-state") === "on" ||
          researchControl.getAttribute("data-state") === "active";
        if (!selected) {
          researchControl.click();
          await pause(350);
        }
      }
      composer.focus();
      if (composer instanceof HTMLTextAreaElement || composer instanceof HTMLInputElement) {
        const prototype = composer instanceof HTMLTextAreaElement
          ? HTMLTextAreaElement.prototype
          : HTMLInputElement.prototype;
        const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
        if (!setter) {
          return { status: "failed", message: "The provider composer is not writable." };
        }
        setter.call(composer, prompt);
        composer.dispatchEvent(new Event("input", { bubbles: true }));
        composer.dispatchEvent(new Event("change", { bubbles: true }));
      } else {
        const selection = window.getSelection();
        const range = document.createRange();
        range.selectNodeContents(composer);
        selection?.removeAllRanges();
        selection?.addRange(range);
        if (!document.execCommand("insertText", false, prompt)) {
          return { status: "failed", message: "The provider composer rejected the prompt." };
        }
      }
      const clearInsertedPrompt = () => {
        const currentText =
          composer instanceof HTMLTextAreaElement || composer instanceof HTMLInputElement
            ? composer.value
            : composer.innerText || composer.textContent || "";
        if (currentText.trim() !== prompt.trim()) return;
        if (composer instanceof HTMLTextAreaElement || composer instanceof HTMLInputElement) {
          const prototype = composer instanceof HTMLTextAreaElement
            ? HTMLTextAreaElement.prototype
            : HTMLInputElement.prototype;
          Object.getOwnPropertyDescriptor(prototype, "value")?.set?.call(composer, "");
          composer.dispatchEvent(new Event("input", { bubbles: true }));
          composer.dispatchEvent(new Event("change", { bubbles: true }));
          return;
        }
        composer.focus();
        const selection = window.getSelection();
        const range = document.createRange();
        range.selectNodeContents(composer);
        selection?.removeAllRanges();
        selection?.addRange(range);
        document.execCommand("insertText", false, "");
      };
      await pause(450);
      let sendButton = null;
      for (const selector of adapter.sendSelectors) {
        sendButton = [...document.querySelectorAll(selector)]
          .find((element) => visible(element) && !element.disabled);
        if (sendButton) break;
      }
      if (!sendButton) {
        clearInsertedPrompt();
        return {
          status: "failed",
          message: "The prompt was prepared, but the provider's Send control was not found."
        };
      }
      if (cancelOnGeoPause && window.__aiWorkspaceGeoCaptureCancelled) {
        clearInsertedPrompt();
        return {
          status: "failed",
          message: "GEO delivery cancelled before submission."
        };
      }
      sendButton.click();
      return {
        status: "submitted",
        message: mode === "deep-research"
          ? "Submitted in " + adapter.researchModeName + "."
          : "Submitted to the provider."
      };
    })()
  `;
}

function isBroadcastScriptResult(
  value: unknown
): value is Pick<BroadcastDeliveryResult, "status" | "message"> {
  if (!value || typeof value !== "object") {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  return (
    (candidate.status === "submitted" ||
      candidate.status === "unsupported" ||
      candidate.status === "failed") &&
    typeof candidate.message === "string"
  );
}

function buildGeoSnapshotScript(adapter: BroadcastAdapter): string {
    const payload = JSON.stringify({
      responseSelectors: adapter.responseSelectors,
      composerSelectors: adapter.composerSelectors
    });
    return `
      (() => {
        const { responseSelectors, composerSelectors } = ${payload};
        const visible = (element) => {
          const bounds = element.getBoundingClientRect();
          const style = getComputedStyle(element);
          return bounds.width > 0 && bounds.height > 0 && style.visibility !== "hidden";
        };
        const composers = composerSelectors.flatMap((selector) => {
          try { return [...document.querySelectorAll(selector)]; } catch { return []; }
        });
        const nodes = [...new Set(responseSelectors.flatMap((selector) => {
          try { return [...document.querySelectorAll(selector)]; } catch { return []; }
        }))]
          .filter((element) =>
            visible(element) &&
            !composers.some((composer) => composer === element || composer.contains(element))
          )
          .filter((element, _index, all) =>
            !all.some((other) => other !== element && element.contains(other))
          )
          .sort((left, right) =>
            left.compareDocumentPosition(right) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1
          );
        const texts = nodes
          .map((element) => (element.innerText || element.textContent || "").trim())
          .filter(Boolean);
        const captureToken = crypto.randomUUID();
        for (const node of nodes) {
          node.setAttribute("data-ai-workspace-geo-baseline", captureToken);
        }
        return {
          captureToken,
          responseCount: texts.length,
          lastResponseText: texts.at(-1) || ""
        };
      })()
    `;
  }

  function isGeoCaptureSnapshot(value: unknown): value is GeoCaptureSnapshot {
    return (
      value !== null &&
      typeof value === "object" &&
      typeof (value as GeoCaptureSnapshot).responseCount === "number" &&
      typeof (value as GeoCaptureSnapshot).captureToken === "string" &&
      typeof (value as GeoCaptureSnapshot).lastResponseText === "string"
    );
  }

  function buildGeoCaptureScript(
    adapter: BroadcastAdapter,
    trustedHosts: readonly string[],
    baseline: GeoCaptureSnapshot,
    mode: BroadcastMode,
    submittedQuestion: string
  ): string {
    const payload = JSON.stringify({
      responseSelectors: adapter.responseSelectors,
      composerSelectors: adapter.composerSelectors,
      streamingSelectors: adapter.streamingSelectors,
      trustedHosts,
      baseline,
      submittedQuestion,
      maxResponseLength: MAX_GEO_RESPONSE_LENGTH,
      timeoutMs: mode === "deep-research" ? 600_000 : 180_000,
      stablePollsRequired: mode === "deep-research" ? 5 : 3
    });
    return `
      (async () => {
        const config = ${payload};
        const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
        const visible = (element) => {
          const bounds = element.getBoundingClientRect();
          const style = getComputedStyle(element);
          return bounds.width > 0 && bounds.height > 0 && style.visibility !== "hidden";
        };
        const trusted = () => {
          const host = location.hostname.toLowerCase();
          return location.protocol === "https:" &&
            config.trustedHosts.some((allowed) => host === allowed || host.endsWith("." + allowed));
        };
        const query = (selectors) => [...new Set(selectors.flatMap((selector) => {
          try { return [...document.querySelectorAll(selector)]; } catch { return []; }
        }))];
        const collectResponses = () => {
          const composers = query(config.composerSelectors);
          const nodes = query(config.responseSelectors)
            .filter((element) =>
              visible(element) &&
              element.getAttribute("data-ai-workspace-geo-baseline") !==
                config.baseline.captureToken &&
              !composers.some((composer) => composer === element || composer.contains(element))
            )
            .filter((element, _index, all) =>
              !all.some((other) => other !== element && element.contains(other))
            )
            .sort((left, right) =>
              left.compareDocumentPosition(right) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1
            );
          return nodes
            .map((element) => ({
              element,
              text: (element.innerText || element.textContent || "").trim()
            }))
            .filter((item) => item.text);
        };
        const blockingMessage = () => {
          const challenge = query([
            "iframe[src*='captcha']",
            "[id*='captcha']",
            "[class*='captcha']",
            "[data-testid*='captcha']"
          ]).find(visible);
          if (challenge) return "CAPTCHA or human verification detected.";
          const alertText = query(["[role='alert']", "[role='dialog']"])
            .filter(visible)
            .map((element) => element.textContent || "")
            .join(" ")
            .toLowerCase();
          const title = document.title.toLowerCase();
          const text = title + " " + alertText;
          const signals = [
            "verify you are human",
            "unusual traffic",
            "too many requests",
            "rate limit",
            "temporarily blocked",
            "suspicious activity"
          ];
          const signal = signals.find((candidate) => text.includes(candidate));
          return signal ? "Provider blocked automation: " + signal + "." : "";
        };
        const isStreaming = () => query(config.streamingSelectors).some(visible);
        const extractCitations = (element) => {
          const seen = new Set();
          const citations = [];
          for (const anchor of element.querySelectorAll("a[href]")) {
            const url = anchor.href;
            if (!url || seen.has(url) || !/^https?:\\/\\//i.test(url)) continue;
            seen.add(url);
            citations.push({
              label: (anchor.innerText || anchor.getAttribute("aria-label") || "").trim().slice(0, 500),
              url: url.slice(0, 2048)
            });
            if (citations.length >= 50) break;
          }
          return citations;
        };

        const startedAt = Date.now();
        let lastText = "";
        let stablePolls = 0;
        let latest = null;
        await pause(2000);
        while (Date.now() - startedAt < config.timeoutMs) {
          if (window.__aiWorkspaceGeoCaptureCancelled) {
            return {
              status: "cancelled",
              response: "",
              citations: [],
              conversationUrl: location.href,
              message: "Capture cancelled."
            };
          }
          if (!trusted()) {
            return {
              status: "blocked",
              response: "",
              citations: [],
              conversationUrl: location.href,
              message: "Provider navigation left its trusted hosts."
            };
          }
          const blocked = blockingMessage();
          if (blocked) {
            return {
              status: "blocked",
              response: "",
              citations: [],
              conversationUrl: location.href,
              message: blocked
            };
          }
          const responses = collectResponses();
          const candidate = responses.at(-1);
          const isNew =
            candidate &&
            candidate.text.trim() !== config.submittedQuestion.trim() &&
            candidate.text !== config.baseline.lastResponseText;
          if (isNew) {
            latest = candidate;
            if (candidate.text.length > config.maxResponseLength) {
              return {
                status: "timeout",
                response: "",
                citations: [],
                conversationUrl: location.href,
                message: "The provider response exceeds the local capture limit."
              };
            }
            if (candidate.text === lastText && !isStreaming()) {
              stablePolls += 1;
            } else {
              stablePolls = 0;
              lastText = candidate.text;
            }
            if (stablePolls >= config.stablePollsRequired) {
              return {
                status: "captured",
                response: candidate.text,
                citations: extractCitations(candidate.element),
                conversationUrl: location.href,
                message: "Stable provider response captured."
              };
            }
          }
          await pause(1500);
        }
        return {
          status: "timeout",
          response: latest?.text || "",
          citations: latest ? extractCitations(latest.element) : [],
          conversationUrl: location.href,
          message: latest
            ? "A response was found but did not become stable before the timeout."
            : "No new provider response was detected before the timeout."
        };
      })()
    `;
  }

  function isGeoCapturedResponse(value: unknown): value is GeoCapturedResponse {
    if (!value || typeof value !== "object") {
      return false;
    }
    const candidate = value as Record<string, unknown>;
    return (
      ["captured", "blocked", "timeout", "cancelled", "failed"].includes(
        String(candidate.status)
      ) &&
      typeof candidate.response === "string" &&
      Array.isArray(candidate.citations) &&
      candidate.citations.every(
        (citation) =>
          citation !== null &&
          typeof citation === "object" &&
          typeof (citation as Record<string, unknown>).label === "string" &&
          typeof (citation as Record<string, unknown>).url === "string"
      ) &&
      typeof candidate.conversationUrl === "string" &&
      typeof candidate.message === "string"
    );
  }

  async function performGeoQuestion(
    account: AccountProfile,
    question: string,
    mode: BroadcastMode,
    onSubmitted: () => Promise<void>
  ): Promise<GeoCapturedResponse> {
    try {
      let managedView = managedViews.get(account.id);
      if (!managedView || managedView.view.webContents.isDestroyed()) {
        managedView = createManagedView(account);
        managedViews.set(account.id, managedView);
      }
      managedView.lastActivatedAt = Date.now();
      await waitForViewReady(managedView);
      const service = SERVICE_BY_ID.get(account.serviceId);
      if (
        !service ||
        !isTrustedUrl(
          account.serviceId,
          managedView.view.webContents.getURL(),
          false
        )
      ) {
        throw new Error("The provider is not on a trusted signed-in page.");
      }
      const adapter = BROADCAST_ADAPTERS[account.serviceId];
      const snapshotValue: unknown = await managedView.view.webContents.executeJavaScript(
        buildGeoSnapshotScript(adapter),
        true
      );
      if (!isGeoCaptureSnapshot(snapshotValue)) {
        throw new Error("Unable to inspect the provider conversation before sending.");
      }
      const deliveryValue: unknown = await managedView.view.webContents.executeJavaScript(
        buildBroadcastScript(adapter, question, mode, true, true),
        true
      );
      if (!isBroadcastScriptResult(deliveryValue)) {
        throw new Error("The provider returned an invalid delivery result.");
      }
      if (deliveryValue.status !== "submitted") {
        return {
          status: "failed",
          response: "",
          citations: [],
          conversationUrl: managedView.view.webContents.getURL(),
          message: deliveryValue.message
        };
      }
      await onSubmitted();
      const captureValue: unknown = await managedView.view.webContents.executeJavaScript(
        buildGeoCaptureScript(
          adapter,
          service.trustedHosts,
          snapshotValue,
          mode,
          question
        ),
        true
      );
      if (!isGeoCapturedResponse(captureValue)) {
        throw new Error("The provider returned an invalid capture result.");
      }
      return captureValue;
    } catch (error) {
      return {
        status: "failed",
        response: "",
        citations: [],
        conversationUrl: "",
        message:
          error instanceof Error
            ? error.message
            : "The GEO question could not be completed."
      };
    }
  }

  function deliverGeoQuestion(
    studyId: string,
    account: AccountProfile,
    question: string,
    mode: BroadcastMode,
    onSubmitted: () => Promise<void>
  ): Promise<GeoCapturedResponse> {
    const previous = accountDeliveryQueues.get(account.id) ?? Promise.resolve();
    const delivery = previous.then(() =>
      cancelledGeoStudies.has(studyId)
        ? {
            status: "cancelled" as const,
            response: "",
            citations: [],
            conversationUrl: "",
            message: "Capture cancelled before submission."
          }
        : performGeoQuestion(account, question, mode, onSubmitted)
    );
    const tail = delivery.then(
      () => undefined,
      () => undefined
    );
    accountDeliveryQueues.set(account.id, tail);
    return delivery.finally(() => {
      if (accountDeliveryQueues.get(account.id) === tail) {
        accountDeliveryQueues.delete(account.id);
      }
      enforceWarmViewLimit();
    });
}

type PromptDeliverySource = PromptHistoryEntry["source"] | "research";

async function performBroadcastDelivery(
  account: AccountProfile,
  prompt: string,
  mode: BroadcastMode,
  source: PromptDeliverySource
): Promise<BroadcastDeliveryResult> {
  try {
    let managedView = managedViews.get(account.id);
    if (!managedView || managedView.view.webContents.isDestroyed()) {
      managedView = createManagedView(account);
      managedViews.set(account.id, managedView);
    }
    managedView.lastActivatedAt = Date.now();
    await waitForViewReady(managedView);
    const adapter = BROADCAST_ADAPTERS[account.serviceId];
    const result: unknown = await managedView.view.webContents.executeJavaScript(
      buildBroadcastScript(adapter, prompt, mode, source === "schedule"),
      true
    );
    if (!isBroadcastScriptResult(result)) {
      throw new Error("The provider returned an invalid delivery result.");
    }
    return {
      accountId: account.id,
      serviceId: account.serviceId,
      status: result.status,
      message: result.message
    };
  } catch (error) {
    return {
      accountId: account.id,
      serviceId: account.serviceId,
      status: "failed",
      message: error instanceof Error ? error.message : "The prompt could not be submitted."
    };
  }
}

function deliverBroadcast(
  account: AccountProfile,
  prompt: string,
  mode: BroadcastMode,
  source: PromptDeliverySource
): Promise<BroadcastDeliveryResult> {
  const previous = accountDeliveryQueues.get(account.id) ?? Promise.resolve();
  const delivery = previous.then(() =>
    performBroadcastDelivery(account, prompt, mode, source)
  );
  const tail = delivery.then(
    () => undefined,
    () => undefined
  );
  accountDeliveryQueues.set(account.id, tail);
  return delivery.finally(() => {
    if (accountDeliveryQueues.get(account.id) === tail) {
      accountDeliveryQueues.delete(account.id);
    }
  });
}

async function executeBroadcast(
  request: BroadcastRequest,
  source: PromptDeliverySource,
  sensitiveDataConsentDigests?: Record<string, string>
): Promise<BroadcastResult> {
  const accounts: AccountProfile[] = [];
  const effectivePrompts = new Map<string, string>();
  for (const accountId of request.accountIds) {
    const account = accountStore.get(accountId);
    if (!account) {
      throw new Error("One or more selected accounts no longer exist.");
    }
    accounts.push(account);
    effectivePrompts.set(account.id, promptForAccount(account.id, request.prompt));
  }

  if (source === "broadcast" || source === "research") {
    retainedComparisonAccountIds.clear();
    enforceWarmViewLimit();
  }

  if (source === "schedule" && request.allowSensitiveData) {
    const consentMatches = accounts.every((account) => {
      const effectivePrompt = effectivePrompts.get(account.id);
      return (
        effectivePrompt !== undefined &&
        sensitiveDataConsentDigests?.[account.id] ===
          effectivePayloadDigest(account.id, effectivePrompt)
      );
    });
    if (!consentMatches) {
      throw new Error(
        "Saved account context changed after sensitive-data consent. Review and recreate this schedule before it can run."
      );
    }
  }

  if (!request.allowSensitiveData) {
    const protectedFinding = accounts.some(
      (account) =>
        dataProtectionSettings[account.serviceId] &&
        scanSensitiveData(effectivePrompts.get(account.id) ?? "").length > 0
    );
    if (protectedFinding) {
      throw new Error(
        "Sensitive data was found in the prompt or saved account context. Review it before allowing delivery."
      );
    }
  }

  const deliveries = await Promise.all(
    accounts.map((account) =>
      deliverBroadcast(
        account,
        effectivePrompts.get(account.id) ?? request.prompt,
        request.mode,
        source
      )
    )
  );
  if (source === "broadcast" || source === "research") {
    for (const delivery of deliveries) {
      if (delivery.status === "submitted") {
        retainedComparisonAccountIds.add(delivery.accountId);
      }
    }
  }
  if (source !== "research") {
    await promptHistoryStore.record(request, source);
  }
  enforceWarmViewLimit();
  return { deliveries };
}

function emitGeoStudyProgress(studyId: string, resultId?: string): void {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }
  const study = geoStudyStore.list().find((candidate) => candidate.id === studyId);
  if (!study) {
    return;
  }
  mainWindow.webContents.send("geo:progress", {
    studyId,
    status: study.status,
    updatedAt: study.updatedAt,
    ...(study.pauseReason ? { pauseReason: study.pauseReason } : {}),
    ...(study.startedAt ? { startedAt: study.startedAt } : {}),
    ...(study.completedAt ? { completedAt: study.completedAt } : {}),
    ...(resultId
      ? { result: study.results.find((candidate) => candidate.id === resultId) }
      : {})
  });
}

async function updateGeoResultAndEmit(
  studyId: string,
  resultId: string,
  status: GeoResult["status"],
  patch: Parameters<GeoStudyStore["updateResultStatus"]>[3] = {}
): Promise<void> {
  await geoStudyStore.updateResultStatus(studyId, resultId, status, patch);
  emitGeoStudyProgress(studyId, resultId);
}

async function pauseGeoStudyForIssue(
  studyId: string,
  reason: string
): Promise<void> {
  cancelledGeoStudies.add(studyId);
  await geoStudyStore.setStatus(studyId, "paused", reason);
  emitGeoStudyProgress(studyId);
}

async function runGeoStudy(studyId: string): Promise<void> {
  try {
    while (!cancelledGeoStudies.has(studyId)) {
      const study = geoStudyStore.get(studyId);
      if (!study || study.status !== "running") {
        break;
      }
      const result = study.results.find((candidate) => candidate.status === "pending");
      if (!result) {
        await geoStudyStore.setStatus(studyId, "completed");
        emitGeoStudyProgress(studyId);
        break;
      }
      const question = study.questions.find(
        (candidate) => candidate.id === result.questionId
      );
      const account = accountStore.get(result.accountId);
      if (!question || !account) {
        await updateGeoResultAndEmit(studyId, result.id, "failed", {
          error: "The question or connected account no longer exists."
        });
        await pauseGeoStudyForIssue(
          studyId,
          "The batch paused because a question or account is no longer available."
        );
        break;
      }
      if (
        dataProtectionSettings[account.serviceId] &&
        !study.allowSensitiveData &&
        scanSensitiveData(question.text).length > 0
      ) {
        await updateGeoResultAndEmit(studyId, result.id, "failed", {
          error: "Sensitive data was detected in this question."
        });
        await pauseGeoStudyForIssue(
          studyId,
          "Sensitive data was detected. Review the study before retrying."
        );
        break;
      }

      await updateGeoResultAndEmit(studyId, result.id, "sending", {
        error: undefined
      });
      const captured = await deliverGeoQuestion(
        studyId,
        account,
        question.text,
        study.mode,
        async () => {
          await updateGeoResultAndEmit(studyId, result.id, "waiting");
        }
      );

      if (cancelledGeoStudies.has(studyId) || captured.status === "cancelled") {
        await updateGeoResultAndEmit(studyId, result.id, "pending", {
          error: undefined
        });
        break;
      }
      if (captured.status === "captured") {
        await updateGeoResultAndEmit(studyId, result.id, "captured", {
          response: captured.response,
          citations: captured.citations,
          captureMethod: "automatic",
          conversationUrl: captured.conversationUrl,
          capturedAt: new Date().toISOString(),
          verified: false,
          error: undefined
        });
        await new Promise((resolve) => setTimeout(resolve, 1_500));
        continue;
      }
      if (captured.status === "timeout") {
        await updateGeoResultAndEmit(studyId, result.id, "needs-review", {
          response: captured.response,
          citations: captured.citations,
          captureMethod: "automatic",
          conversationUrl: captured.conversationUrl,
          ...(captured.response
            ? { capturedAt: new Date().toISOString() }
            : {}),
          verified: false,
          error: captured.message
        });
        await pauseGeoStudyForIssue(
          studyId,
          "Automatic capture was uncertain. Review this result before resuming."
        );
        break;
      }
      const resultStatus = captured.status === "blocked" ? "blocked" : "failed";
      await updateGeoResultAndEmit(studyId, result.id, resultStatus, {
        conversationUrl: captured.conversationUrl,
        error: captured.message
      });
      await pauseGeoStudyForIssue(studyId, captured.message);
      break;
    }
  } catch (error) {
    const reason =
      error instanceof Error ? error.message : "The GEO batch stopped unexpectedly.";
    await geoStudyStore.setStatus(studyId, "paused", reason);
    emitGeoStudyProgress(studyId);
  } finally {
    runningGeoStudies.delete(studyId);
  }
}

async function stopRunningGeoStudies(reason: string): Promise<void> {
  const activeStudyIds = [...runningGeoStudies.keys()];
  for (const studyId of activeStudyIds) {
    cancelledGeoStudies.add(studyId);
    if (geoStudyStore.get(studyId)?.status === "running") {
      await geoStudyStore.setStatus(studyId, "paused", reason);
    }
  }
  await Promise.allSettled(
    [...managedViews.values()].map((managedView) =>
      managedView.view.webContents.isDestroyed()
        ? Promise.resolve()
        : managedView.view.webContents.executeJavaScript(
            "window.__aiWorkspaceGeoCaptureCancelled = true",
            true
          )
    )
  );
  await Promise.allSettled([...runningGeoStudies.values()]);
}

function emitSchedulesChanged(): void {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("schedules:changed", scheduleStore.list());
  }
}

async function runDueSchedules(): Promise<void> {
  if (isRunningSchedules) {
    return;
  }
  isRunningSchedules = true;
  try {
    const now = Date.now();
    const dueSchedules = scheduleStore
      .list()
      .filter(
        (schedule) =>
          schedule.enabled &&
          schedule.nextRunAt !== null &&
          Date.parse(schedule.nextRunAt) <= now
      )
      .sort((left, right) =>
        (left.nextRunAt ?? "").localeCompare(right.nextRunAt ?? "")
      );

    for (const due of dueSchedules) {
      const dueAt = due.nextRunAt;
      if (!dueAt) {
        continue;
      }
      const claimed = await scheduleStore.claimRun(due.id, dueAt);
      if (!claimed) {
        continue;
      }
      emitSchedulesChanged();
      let outcome: ScheduleOutcome;
      try {
        const result = await executeBroadcast(
          {
            accountIds: claimed.accountIds,
            prompt: claimed.prompt,
            mode: claimed.mode,
            allowSensitiveData: claimed.allowSensitiveData
          },
          "schedule",
          claimed.sensitiveDataConsentDigests
        );
        const submitted = result.deliveries.filter(
          (delivery) => delivery.status === "submitted"
        ).length;
        const failedDeliveries = result.deliveries.filter(
          (delivery) => delivery.status !== "submitted"
        );
        const failed = failedDeliveries.length;
        const failureDetails = failedDeliveries
          .map((delivery) => {
            const label = accountStore.get(delivery.accountId)?.label ?? delivery.serviceId;
            return `${label}: ${delivery.message}`;
          })
          .join(" ");
        outcome = {
          status:
            submitted === result.deliveries.length
              ? "success"
              : submitted > 0
                ? "partial"
                : "failed",
          completedAt: new Date().toISOString(),
          message:
            failed === 0
              ? `Submitted to ${submitted} account${submitted === 1 ? "" : "s"}.`
              : `Submitted to ${submitted}; ${failed} delivery attempt${
                 failed === 1 ? "" : "s"
                } did not complete. ${failureDetails}`.slice(0, 500)
        };
      } catch (error) {
        outcome = {
          status: "failed",
          completedAt: new Date().toISOString(),
          message: error instanceof Error ? error.message.slice(0, 500) : "Delivery failed."
        };
      }
      await scheduleStore.completeRun(claimed.id, outcome);
      emitSchedulesChanged();
    }
  } finally {
    isRunningSchedules = false;
  }
}

function detachView(managedView: ManagedView): void {
  if (!mainWindow || !managedView.attached) {
    return;
  }
  mainWindow.contentView.removeChildView(managedView.view);
  managedView.attached = false;
}

function attachView(managedView: ManagedView): void {
  if (!mainWindow) {
    throw new Error("Main window is not available.");
  }
  if (!isActiveViewVisible) {
    return;
  }
  if (!managedView.attached) {
    mainWindow.contentView.addChildView(managedView.view);
    managedView.attached = true;
  }
  managedView.view.setBounds(activeBounds);
}

function destroyManagedView(accountId: string): void {
  const managedView = managedViews.get(accountId);
  if (!managedView) {
    return;
  }
  detachView(managedView);
  if (!managedView.view.webContents.isDestroyed()) {
    managedView.view.webContents.close();
  }
  managedViews.delete(accountId);
}

function enforceWarmViewLimit(): void {
  if (managedViews.size <= MAX_WARM_VIEWS) {
    return;
  }

  const candidates = [...managedViews.values()]
    .filter(
      (managedView) =>
        managedView.accountId !== activeAccountId &&
        !retainedComparisonAccountIds.has(managedView.accountId) &&
        !accountDeliveryQueues.has(managedView.accountId)
    )
    .sort((left, right) => left.lastActivatedAt - right.lastActivatedAt);

  while (managedViews.size > MAX_WARM_VIEWS && candidates.length > 0) {
    const candidate = candidates.shift();
    if (candidate) {
      destroyManagedView(candidate.accountId);
    }
  }
}

async function performAccountSelection(accountId: string): Promise<void> {
  const account = accountStore.get(accountId);
  if (!account) {
    throw new Error("Account not found.");
  }

  await flushActiveUsage();
  const previousAccountId = activeAccountId;
  if (activeAccountId) {
    const current = managedViews.get(activeAccountId);
    if (current) {
      detachView(current);
    }
  }

  activeAccountId = accountId;
  let managedView = managedViews.get(accountId);
  if (!managedView || managedView.view.webContents.isDestroyed()) {
    managedView = createManagedView(account);
    managedViews.set(accountId, managedView);
  }
  managedView.lastActivatedAt = Date.now();
  attachView(managedView);
  await accountStore.touch(accountId);
  await usageStore.recordOpen(
    account,
    previousAccountId !== null && previousAccountId !== accountId
  );
  beginActiveUsage();
  emitViewState(managedView);
  enforceWarmViewLimit();
}

function enqueueAccountSelection<T>(operation: () => Promise<T>): Promise<T> {
  const result = accountSelectionQueue.then(operation);
  accountSelectionQueue = result.then(
    () => undefined,
    () => undefined
  );
  return result;
}

function selectAccount(accountId: string): Promise<AccountProfile[]> {
  return enqueueAccountSelection(async () => {
    await performAccountSelection(accountId);
    return accountStore.list();
  });
}

function selectRecentAccount(serviceId: ServiceId): Promise<ProviderSelectionResult> {
  return enqueueAccountSelection(async () => {
    const account = accountStore
      .list()
      .filter((candidate) => candidate.serviceId === serviceId)
      .sort((left, right) => Date.parse(right.lastUsedAt) - Date.parse(left.lastUsedAt))[0];
    if (!account) {
      throw new Error("No account is connected for this provider.");
    }
    await performAccountSelection(account.id);
    return { accountId: account.id, accounts: accountStore.list() };
  });
}

function getActiveView(): ManagedView | undefined {
  return activeAccountId ? managedViews.get(activeAccountId) : undefined;
}

function normalizeBounds(value: unknown): ViewBounds | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const candidate = value as Record<string, unknown>;
  if (
    typeof candidate.x !== "number" ||
    typeof candidate.y !== "number" ||
    typeof candidate.width !== "number" ||
    typeof candidate.height !== "number"
  ) {
    return null;
  }

  return {
    x: Math.max(0, Math.round(candidate.x)),
    y: Math.max(0, Math.round(candidate.y)),
    width: Math.max(1, Math.round(candidate.width)),
    height: Math.max(1, Math.round(candidate.height))
  };
}

function normalizeAccountSettingsUpdate(
  accountId: string,
  value: unknown
): AccountProviderSettings | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const candidate = value as Record<string, unknown>;
  const settings: AccountProviderSettings = {
    accountId,
    defaultBroadcastMode:
      candidate.defaultBroadcastMode === "deep-research" ? "deep-research" : "standard",
    contextNote:
      typeof candidate.contextNote === "string" ? candidate.contextNote.trim() : "",
    includeContextInPrompts: candidate.includeContextInPrompts === true,
    zoomPercent:
      typeof candidate.zoomPercent === "number" ? candidate.zoomPercent : Number.NaN,
    updatedAt: new Date().toISOString()
  };
  return isAccountProviderSettings(settings) ? settings : null;
}

function normalizeCreateScheduleRequest(value: unknown): CreateScheduleRequest | null {
  const broadcast = normalizeBroadcastRequest(value);
  if (!broadcast || !value || typeof value !== "object") {
    return null;
  }
  const candidate = value as Record<string, unknown>;
  if (
    !isScheduleRecurrence(candidate.recurrence) ||
    !isIsoDate(candidate.firstRunAt) ||
    !isValidTimeZone(candidate.timeZone) ||
    typeof candidate.localStartAt !== "string"
  ) {
    return null;
  }
  const localMatch =
    /^(\d{4})-(\d{2})-(\d{2})T([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$/.exec(
      candidate.localStartAt
    );
  if (!localMatch) {
    return null;
  }
  const localParts: LocalDateTimeParts = {
    year: Number(localMatch[1]),
    month: Number(localMatch[2]),
    day: Number(localMatch[3]),
    hour: Number(localMatch[4]),
    minute: Number(localMatch[5]),
    second: Number(localMatch[6] ?? 0),
    millisecond: 0
  };
  const resolvedFirstRun = dateAtLocalWallClock(localParts, candidate.timeZone);
  const resolvedLocal = localPartsAt(resolvedFirstRun, candidate.timeZone);
  if (
    resolvedLocal.year !== localParts.year ||
    resolvedLocal.month !== localParts.month ||
    resolvedLocal.day !== localParts.day
  ) {
    return null;
  }
  const firstRun = resolvedFirstRun.getTime();
  const now = Date.now();
  if (
    firstRun <= now ||
    firstRun > now + 366 * 86_400_000 ||
    Math.abs(firstRun - Date.parse(candidate.firstRunAt)) > 1_000
  ) {
    return null;
  }
  return {
    accountIds: broadcast.accountIds,
    prompt: broadcast.prompt,
    mode: broadcast.mode,
    recurrence: candidate.recurrence,
    firstRunAt: resolvedFirstRun.toISOString(),
    timeZone: candidate.timeZone,
    localStartAt: candidate.localStartAt,
    allowSensitiveData: broadcast.allowSensitiveData
  };
}

function registerIpcHandlers(): void {
  ipcMain.on("app:close-confirmed", () => {
    if (isRendererCloseConfirmed) {
      return;
    }
    isRendererCloseConfirmed = true;
    isRendererCloseRequestPending = false;
    if (pendingUpdateInstall) {
      void installDownloadedUpdate();
      return;
    }
    if (isQuitRequested) {
      app.quit();
    } else {
      mainWindow?.close();
    }
  });
  ipcMain.on("app:close-cancelled", () => {
    isQuitRequested = false;
    isRendererCloseRequestPending = false;
    isRendererCloseConfirmed = false;
    const request = pendingUpdateInstall;
    pendingUpdateInstall = null;
    request?.reject(new Error("Update installation was cancelled."));
  });
  ipcMain.handle("accounts:list", () => accountStore.list());

  ipcMain.handle("accounts:add", async (_event, serviceId: unknown, rawLabel: unknown) => {
    if (!isServiceId(serviceId)) {
      throw new Error("Unsupported service.");
    }
    if (typeof rawLabel !== "string") {
      throw new Error("Account label is required.");
    }
    const label = rawLabel.trim();
    if (label.length < 1 || label.length > 40) {
      throw new Error("Account label must contain between 1 and 40 characters.");
    }
    return accountStore.add(serviceId, label);
  });

  ipcMain.handle("accounts:remove", async (_event, accountId: unknown) => {
    if (typeof accountId !== "string") {
      throw new Error("Invalid account identifier.");
    }
    const account = accountStore.get(accountId);
    if (!account) {
      throw new Error("Account not found.");
    }

    const confirmationOptions: Electron.MessageBoxOptions = {
      type: "warning",
      buttons: ["Cancel", "Remove account"],
      defaultId: 0,
      cancelId: 0,
      title: "Remove account",
      message: `Remove "${account.label}"?`,
      detail: "This clears the local browser session for this account. It does not delete your account with the provider."
    };
    const result = mainWindow
      ? await dialog.showMessageBox(mainWindow, confirmationOptions)
      : await dialog.showMessageBox(confirmationOptions);

    if (result.response === 0) {
      const response: RemoveAccountResult = {
        removed: false,
        accounts: accountStore.list()
      };
      return response;
    }

    const partition = partitionFor(account);
    await flushActiveUsage();
    destroyManagedView(accountId);
    if (activeAccountId === accountId) {
      activeAccountId = null;
    }
    await session.fromPartition(partition).clearStorageData();
    await session.fromPartition(partition).clearCache();
    await scheduleStore.removeAccount(accountId);
    const accounts = await accountStore.remove(accountId);
    await accountSettingsStore.remove(accountId);
    retainedComparisonAccountIds.delete(accountId);
    emitSchedulesChanged();
    const response: RemoveAccountResult = { removed: true, accounts };
    return response;
  });

  ipcMain.handle("views:select", async (_event, accountId: unknown) => {
    if (typeof accountId !== "string") {
      throw new Error("Invalid account identifier.");
    }
    return selectAccount(accountId);
  });
  ipcMain.handle("views:select-recent", (_event, serviceId: unknown) => {
    if (!isServiceId(serviceId)) {
      throw new Error("Unsupported service.");
    }
    return selectRecentAccount(serviceId);
  });

  ipcMain.on("views:set-bounds", (_event, value: unknown) => {
    const bounds = normalizeBounds(value);
    if (!bounds) {
      return;
    }
    const scale = preferencesStore.get().appZoomPercent / 100;
    activeBounds = {
      x: Math.round(bounds.x * scale),
      y: Math.round(bounds.y * scale),
      width: Math.round(bounds.width * scale),
      height: Math.round(bounds.height * scale)
    };
    const activeView = getActiveView();
    if (activeView?.attached) {
      activeView.view.setBounds(activeBounds);
    }
  });

  ipcMain.on("views:set-visible", (_event, visible: unknown) => {
    if (typeof visible !== "boolean") {
      return;
    }
    if (!visible) {
      void flushActiveUsage().catch((error: unknown) => {
        console.error("Unable to persist active usage.", error);
      });
    }
    isActiveViewVisible = visible;
    const activeView = getActiveView();
    if (!activeView) {
      return;
    }
    if (visible) {
      attachView(activeView);
      beginActiveUsage();
    } else {
      detachView(activeView);
    }
  });

  ipcMain.handle("views:go-back", () => {
    const contents = getActiveView()?.view.webContents;
    if (contents?.navigationHistory.canGoBack()) {
      contents.navigationHistory.goBack();
    }
  });

  ipcMain.handle("views:go-forward", () => {
    const contents = getActiveView()?.view.webContents;
    if (contents?.navigationHistory.canGoForward()) {
      contents.navigationHistory.goForward();
    }
  });

  ipcMain.handle("views:reload", () => {
    getActiveView()?.view.webContents.reload();
  });

  ipcMain.handle("views:open-current-external", async () => {
    const currentUrl = getActiveView()?.view.webContents.getURL();
    if (currentUrl) {
      openExternalHttps(currentUrl);
    }
  });

  ipcMain.handle("usage:summary", async (_event, periodDays: unknown) => {
    if (!isUsagePeriodDays(periodDays)) {
      throw new Error("Usage period must be 7 or 30 days.");
    }
    await flushActiveUsage();
    beginActiveUsage();
    return usageStore.summarize(periodDays);
  });

  ipcMain.handle("usage:export-csv", async (_event, periodDays: unknown) => {
    if (!isUsagePeriodDays(periodDays)) {
      throw new Error("Usage period must be 7 or 30 days.");
    }

    try {
      try {
        await flushActiveUsage();
      } catch (error) {
        console.error("Unable to flush active usage before export.", error);
        throw new Error("Unable to save current usage before exporting.");
      }

      const exportDate = usageDate(new Date());
      const defaultFilename = `ai-workspace-usage-${exportDate}-${periodDays}-days.csv`;
      let saveResult: Electron.SaveDialogReturnValue;
      try {
        const options: Electron.SaveDialogOptions = {
          title: "Export usage analytics",
          defaultPath: path.join(app.getPath("documents"), defaultFilename),
          filters: [{ name: "CSV files", extensions: ["csv"] }]
        };
        saveResult = mainWindow
          ? await dialog.showSaveDialog(mainWindow, options)
          : await dialog.showSaveDialog(options);
      } catch (error) {
        console.error("Unable to open the usage export dialog.", error);
        throw new Error("Unable to choose a location for the usage CSV.");
      }

      if (saveResult.canceled || !saveResult.filePath) {
        const response: ExportUsageCsvResult = { status: "cancelled" };
        return response;
      }

      const csv = createUsageCsv(
        periodDays,
        usageStore.list(periodDays),
        accountStore.list()
      );
      try {
        await fs.writeFile(saveResult.filePath, csv.content, "utf8");
      } catch (error) {
        console.error("Unable to write the usage CSV.", error);
        throw new Error("Unable to save the usage CSV at the selected location.");
      }

      const response: ExportUsageCsvResult = {
        status: "saved",
        filePath: saveResult.filePath,
        rowCount: csv.rowCount
      };
      return response;
    } finally {
      beginActiveUsage();
    }
  });

  ipcMain.handle("usage:reset", async (_event, periodDays: unknown) => {
    if (!isUsagePeriodDays(periodDays)) {
      throw new Error("Usage period must be 7 or 30 days.");
    }

    const confirmationOptions: Electron.MessageBoxOptions = {
      type: "warning",
      buttons: ["Cancel", "Reset usage data"],
      defaultId: 0,
      cancelId: 0,
      title: "Reset usage data",
      message: `Reset usage data for the last ${periodDays} days?`,
      detail: "This only removes local activity statistics. Your accounts and sessions are not affected."
    };
    const result = mainWindow
      ? await dialog.showMessageBox(mainWindow, confirmationOptions)
      : await dialog.showMessageBox(confirmationOptions);

    if (result.response === 0) {
      const response: ResetUsageResult = {
        reset: false,
        summary: usageStore.summarize(periodDays)
      };
      return response;
    }

    await flushActiveUsage();
    await usageStore.reset(periodDays);
    beginActiveUsage();
    const response: ResetUsageResult = {
      reset: true,
      summary: usageStore.summarize(periodDays)
    };
    return response;
  });

  ipcMain.handle("preferences:get", () => preferencesStore.get());

  ipcMain.handle("preferences:set", async (_event, value: unknown) => {
    const preferences = normalizePreferences(value);
    if (!preferences) {
      throw new Error("Invalid preference settings.");
    }
    dataProtectionSettings = { ...preferences.dataProtectionByService };
    const previousUpdateChannel = preferencesStore.get().updateChannel;
    await preferencesStore.set(preferences);
    autoUpdater.allowPrerelease = preferences.updateChannel === "beta";
    if (previousUpdateChannel !== preferences.updateChannel && updatesAreSupported()) {
      publishUpdateStatus({
        state: "idle",
        currentVersion: app.getVersion(),
        message: `Update channel changed to ${preferences.updateChannel}. Check again to refresh results.`
      });
    }
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.setZoomFactor(preferences.appZoomPercent / 100);
    }
    await Promise.all([...managedViews.values()].map(applyDataProtectionToView));
    return preferencesStore.get();
  });

  ipcMain.handle("updates:get-status", () => updateStatus);
  ipcMain.handle("updates:check", () => checkForApplicationUpdates());
  ipcMain.handle("updates:download", async () => {
    if (updateStatus.state !== "available") {
      throw new Error("No update is ready to download.");
    }
    await autoUpdater.downloadUpdate();
    return updateStatus;
  });
  ipcMain.handle("updates:install", async () => {
    if (updateStatus.state !== "downloaded") {
      throw new Error("No downloaded update is ready to install.");
    }
    if (pendingUpdateInstall) {
      throw new Error("Update installation is already waiting for confirmation.");
    }
    isRendererCloseConfirmed = false;
    return new Promise<void>((resolve, reject) => {
      pendingUpdateInstall = { resolve, reject };
      requestRendererCloseConfirmation();
    });
  });

  ipcMain.handle("data-protection:set", async (_event, value: unknown) => {
    const settings = normalizeDataProtectionSettings(value);
    if (!settings) {
      throw new Error("Invalid data protection settings.");
    }
    dataProtectionSettings = settings;
    await preferencesStore.set({
      ...preferencesStore.get(),
      dataProtectionByService: settings
    });
    await Promise.all([...managedViews.values()].map(applyDataProtectionToView));
  });

  ipcMain.handle("account-settings:list", () =>
    accountSettingsStore.list(accountStore.list())
  );

  ipcMain.handle(
    "account-settings:update",
    async (_event, accountId: unknown, value: unknown) => {
      if (typeof accountId !== "string" || !accountStore.get(accountId)) {
        throw new Error("Account not found.");
      }
      const settings = normalizeAccountSettingsUpdate(accountId, value);
      if (!settings) {
        throw new Error(
          "Account settings require valid defaults, context up to 4,000 characters, and zoom from 75% to 200%."
        );
      }
      const result = await accountSettingsStore.set(settings);
      const managedView = managedViews.get(accountId);
      if (managedView && !managedView.view.webContents.isDestroyed()) {
        managedView.view.webContents.setZoomFactor(settings.zoomPercent / 100);
      }
      return result;
    }
  );

  ipcMain.handle("history:list", () => promptHistoryStore.list());
  ipcMain.handle("history:clear", () => promptHistoryStore.clear());

  ipcMain.handle("prompt-templates:list", () => promptTemplateStore.list());
  ipcMain.handle("prompt-templates:create", async (_event, value: unknown) => {
    const input = normalizePromptTemplateInput(value);
    if (!input) {
      throw new Error(
        "Template name must be 1-80 characters, category up to 80, description up to 500, and content 1-12,000 characters."
      );
    }
    return promptTemplateStore.create(input);
  });
  ipcMain.handle(
    "prompt-templates:update",
    async (_event, id: unknown, value: unknown) => {
      if (!isUuid(id)) {
        throw new Error("Invalid prompt template identifier.");
      }
      const input = normalizePromptTemplateInput(value);
      if (!input) {
        throw new Error(
          "Template name must be 1-80 characters, category up to 80, description up to 500, and content 1-12,000 characters."
        );
      }
      return promptTemplateStore.update(id, input);
    }
  );
  ipcMain.handle("prompt-templates:delete", async (_event, id: unknown) => {
    if (!isUuid(id)) {
      throw new Error("Invalid prompt template identifier.");
    }
    const template = promptTemplateStore.get(id);
    if (!template) {
      throw new Error("Prompt template not found.");
    }
    const confirmationOptions: Electron.MessageBoxOptions = {
      type: "warning",
      buttons: ["Cancel", "Delete template"],
      defaultId: 0,
      cancelId: 0,
      title: "Delete prompt template",
      message: `Delete "${template.name}"?`,
      detail: "This removes the template from this device. This action cannot be undone."
    };
    const result = mainWindow
      ? await dialog.showMessageBox(mainWindow, confirmationOptions)
      : await dialog.showMessageBox(confirmationOptions);
    if (result.response === 0) {
      return false;
    }
    await promptTemplateStore.delete(id);
    return true;
  });

  ipcMain.handle("schedules:list", () => scheduleStore.list());
  ipcMain.handle("schedules:create", async (_event, value: unknown) => {
    const request = normalizeCreateScheduleRequest(value);
    if (!request) {
      throw new Error(
        "Choose 1-8 existing accounts, a future time within one year, a recurrence, and a prompt up to 12,000 characters."
      );
    }
    for (const accountId of request.accountIds) {
      if (!accountStore.get(accountId)) {
        throw new Error("One or more selected accounts no longer exist.");
      }
    }
    if (!request.allowSensitiveData) {
      const hasSensitiveData = request.accountIds.some((accountId) => {
        const account = accountStore.get(accountId);
        return (
          account !== undefined &&
          dataProtectionSettings[account.serviceId] &&
          scanSensitiveData(promptForAccount(accountId, request.prompt)).length > 0
        );
      });
      if (hasSensitiveData) {
        throw new Error(
          "Sensitive data was found in the prompt or saved account context. Review it before saving this schedule."
        );
      }
    }
    const schedule = await scheduleStore.create(
      request,
      request.allowSensitiveData ? consentDigestsForRequest(request) : undefined
    );
    emitSchedulesChanged();
    return schedule;
  });
  ipcMain.handle(
    "schedules:set-enabled",
    async (_event, scheduleId: unknown, enabled: unknown) => {
      if (typeof scheduleId !== "string" || typeof enabled !== "boolean") {
        throw new Error("Invalid schedule update.");
      }
      const schedule = await scheduleStore.setEnabled(scheduleId, enabled);
      emitSchedulesChanged();
      return schedule;
    }
  );
  ipcMain.handle("schedules:remove", async (_event, scheduleId: unknown) => {
    if (typeof scheduleId !== "string") {
      throw new Error("Invalid schedule identifier.");
    }
    await scheduleStore.remove(scheduleId);
    emitSchedulesChanged();
  });

  ipcMain.handle("research:list", () => researchStore.list());
  ipcMain.handle("research:create", async (_event, value: unknown) => {
    const input = normalizeCreateResearchProjectInput(value);
    if (!input) {
      throw new Error(
        "Research requires a title, a prompt of up to 12,000 characters, and 1-8 accounts."
      );
    }
    return researchStore.create(input, accountStore.list());
  });
  ipcMain.handle(
    "research:add-round",
    async (_event, projectId: unknown, value: unknown) => {
      if (!isUuid(projectId)) {
        throw new Error("Invalid research project identifier.");
      }
      const input = normalizeAddResearchRoundInput(value);
      if (!input) {
        throw new Error(
          "A follow-up round requires a parent, a prompt of up to 12,000 characters, and 1-8 accounts."
        );
      }
      return researchStore.addRound(projectId, input, accountStore.list());
    }
  );
  ipcMain.handle(
    "research:update-round",
    async (
      _event,
      projectId: unknown,
      roundId: unknown,
      value: unknown
    ) => {
      if (!isUuid(projectId) || !isUuid(roundId)) {
        throw new Error("Invalid research project or round identifier.");
      }
      const input = normalizeUpdateResearchRoundInput(value);
      if (!input) {
        throw new Error("Invalid research responses or optimization content.");
      }
      return researchStore.updateRound(projectId, roundId, input);
    }
  );
  ipcMain.handle("research:delete", async (_event, projectId: unknown) => {
    if (!isUuid(projectId)) {
      throw new Error("Invalid research project identifier.");
    }
    const project = researchStore.list().find((candidate) => candidate.id === projectId);
    if (!project) {
      throw new Error("Research project not found.");
    }
    const confirmationOptions: Electron.MessageBoxOptions = {
      type: "warning",
      buttons: ["Cancel", "Delete research"],
      defaultId: 0,
      cancelId: 0,
      title: "Delete research project",
      message: `Delete "${project.title}"?`,
      detail: "All locally captured responses and linked rounds will be removed."
    };
    const result = mainWindow
      ? await dialog.showMessageBox(mainWindow, confirmationOptions)
      : await dialog.showMessageBox(confirmationOptions);
    if (result.response === 0) {
      return false;
    }
    await researchStore.delete(projectId);
    return true;
  });
  ipcMain.handle("research:broadcast", async (_event, value: unknown) => {
    const request = normalizeResearchBroadcastRequest(value);
    if (!request) {
      throw new Error(
        "Choose 1-8 accounts and enter a research prompt within the supported local limit."
      );
    }
    return executeBroadcast(request, "research");
  });

  ipcMain.handle("geo:list", () => geoStudyStore.list());
  ipcMain.handle("geo:create", async (_event, value: unknown) => {
    const input = normalizeCreateGeoStudyInput(value);
    if (!input) {
      throw new Error(
        "A GEO study requires a title, brand, 1-8 accounts, and 1-100 unique questions."
      );
    }
    const study = await geoStudyStore.create(input, accountStore.list());
    return study;
  });
  ipcMain.handle("geo:start", async (_event, studyId: unknown) => {
    if (!isUuid(studyId)) {
      throw new Error("Invalid GEO study identifier.");
    }
    const study = geoStudyStore.get(studyId);
    if (!study) {
      throw new Error("GEO study not found.");
    }
    if (runningGeoStudies.size > 0) {
      throw new Error("Only one supervised GEO batch can run at a time.");
    }
    if (!study.results.some((result) => result.status === "pending")) {
      throw new Error("This GEO study has no pending provider questions.");
    }
    for (const accountId of study.accountIds) {
      if (!accountStore.get(accountId)) {
        throw new Error("One or more GEO accounts no longer exist.");
      }
    }
    runningGeoStudies.set(studyId, Promise.resolve());
    try {
      cancelledGeoStudies.delete(studyId);
      await Promise.allSettled(
        [...managedViews.values()].map((managedView) =>
          managedView.view.webContents.isDestroyed()
            ? Promise.resolve()
            : managedView.view.webContents.executeJavaScript(
                "window.__aiWorkspaceGeoCaptureCancelled = false",
                true
              )
        )
      );
      const runningStudy = await geoStudyStore.setStatus(studyId, "running");
      emitGeoStudyProgress(studyId);
      const runPromise = runGeoStudy(studyId);
      runningGeoStudies.set(studyId, runPromise);
      void runPromise;
      return runningStudy;
    } catch (error) {
      runningGeoStudies.delete(studyId);
      throw error;
    }
  });
  ipcMain.handle("geo:pause", async (_event, studyId: unknown) => {
    if (!isUuid(studyId) || !geoStudyStore.get(studyId)) {
      throw new Error("GEO study not found.");
    }
    cancelledGeoStudies.add(studyId);
    await Promise.allSettled(
      [...managedViews.values()].map((managedView) =>
        managedView.view.webContents.isDestroyed()
          ? Promise.resolve()
          : managedView.view.webContents.executeJavaScript(
              "window.__aiWorkspaceGeoCaptureCancelled = true",
              true
            )
      )
    );
    const study = await geoStudyStore.setStatus(
      studyId,
      "paused",
      "Paused by the user."
    );
    emitGeoStudyProgress(studyId);
    return study;
  });
  ipcMain.handle("geo:retry-failures", async (_event, studyId: unknown) => {
    if (!isUuid(studyId)) {
      throw new Error("Invalid GEO study identifier.");
    }
    if (runningGeoStudies.has(studyId)) {
      throw new Error("Pause the GEO study before retrying results.");
    }
    const study = await geoStudyStore.resetFailed(studyId);
    const paused = await geoStudyStore.setStatus(
      studyId,
      "paused",
      "Issue results are ready to retry."
    );
    emitGeoStudyProgress(studyId);
    return paused;
  });
  ipcMain.handle(
    "geo:update-result",
    async (
      _event,
      studyId: unknown,
      resultId: unknown,
      value: unknown
    ) => {
      if (!isUuid(studyId) || !isUuid(resultId)) {
        throw new Error("Invalid GEO study or result identifier.");
      }
      if (runningGeoStudies.has(studyId)) {
        throw new Error("Pause the GEO batch before editing captured results.");
      }
      const input = normalizeUpdateGeoResultInput(value);
      if (!input) {
        throw new Error("Invalid GEO result content.");
      }
      const study = await geoStudyStore.updateManualResult(
        studyId,
        resultId,
        input
      );
      emitGeoStudyProgress(studyId, resultId);
      return study;
    }
  );
  ipcMain.handle("geo:delete", async (_event, studyId: unknown) => {
    if (!isUuid(studyId)) {
      throw new Error("Invalid GEO study identifier.");
    }
    if (runningGeoStudies.has(studyId)) {
      throw new Error("Pause the GEO study before deleting it.");
    }
    const study = geoStudyStore.get(studyId);
    if (!study) {
      throw new Error("GEO study not found.");
    }
    const options: Electron.MessageBoxOptions = {
      type: "warning",
      buttons: ["Cancel", "Delete GEO study"],
      defaultId: 0,
      cancelId: 0,
      title: "Delete GEO study",
      message: `Delete "${study.title}"?`,
      detail: "All imported questions and captured provider responses will be removed."
    };
    const confirmation = mainWindow
      ? await dialog.showMessageBox(mainWindow, options)
      : await dialog.showMessageBox(options);
    if (confirmation.response === 0) {
      return false;
    }
    await geoStudyStore.delete(studyId);
    return true;
  });

  ipcMain.handle("broadcast:send", async (_event, value: unknown) => {
    const request = normalizeBroadcastRequest(value);
    if (!request) {
      throw new Error("Choose 1-8 accounts and enter a prompt of up to 12,000 characters.");
    }
    return executeBroadcast(request, "broadcast");
  });
  ipcMain.handle("broadcast:release-views", () => {
    retainedComparisonAccountIds.clear();
    enforceWarmViewLimit();
  });
}

async function createMainWindow(): Promise<void> {
  isQuitRequested = false;
  isRendererCloseConfirmed = false;
  isRendererCloseRequestPending = false;
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 680,
    show: false,
    backgroundColor: "#0b0d12",
    title: "AI Workspace",
    autoHideMenuBar: true,
    ...(!app.isPackaged
      ? { icon: path.join(app.getAppPath(), "build", "icon.png") }
      : {}),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true
    }
  });
  mainWindow.webContents.setZoomFactor(preferencesStore.get().appZoomPercent / 100);
  mainWindow.webContents.on("before-input-event", (event, input) => {
    handleApplicationZoomShortcut(event, input);
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    openExternalHttps(url);
    return { action: "deny" };
  });

  const showMainWindow = () => {
    if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.isVisible()) {
      mainWindow.show();
    }
  };
  mainWindow.once("ready-to-show", showMainWindow);
  mainWindow.webContents.once("did-finish-load", showMainWindow);
  mainWindow.on("focus", () => beginActiveUsage());
  mainWindow.on("blur", () => {
    void flushActiveUsage().catch((error: unknown) => {
      console.error("Unable to persist active usage.", error);
    });
  });
  mainWindow.on("close", (event) => {
    if (!isRendererCloseConfirmed) {
      event.preventDefault();
      requestRendererCloseConfirmation();
      return;
    }
    void flushActiveUsage().catch((error: unknown) => {
      console.error("Unable to persist active usage while closing.", error);
    });
  });
  mainWindow.on("closed", () => {
    for (const accountId of [...managedViews.keys()]) {
      destroyManagedView(accountId);
    }
    activeAccountId = null;
    mainWindow = null;
  });

  const developmentUrl = process.env.VITE_DEV_SERVER_URL;
  if (developmentUrl) {
    await mainWindow.loadURL(developmentUrl);
  } else {
    await mainWindow.loadFile(path.join(__dirname, "../../dist/index.html"));
  }
}

const hasSingleInstanceLock = app.requestSingleInstanceLock();
if (!hasSingleInstanceLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) {
        mainWindow.restore();
      }
      mainWindow.show();
      mainWindow.focus();
    }
  });

  app.whenReady().then(async () => {
    const userDataPath = app.getPath("userData");
    accountStore = new AccountStore(userDataPath);
    usageStore = new UsageStore(userDataPath);
    preferencesStore = new PreferencesStore(userDataPath);
    accountSettingsStore = new AccountSettingsStore(userDataPath);
    promptHistoryStore = new PromptHistoryStore(userDataPath);
    promptTemplateStore = new PromptTemplateStore(userDataPath);
    scheduleStore = new ScheduleStore(userDataPath);
    researchStore = new ResearchStore(userDataPath);
    geoStudyStore = new GeoStudyStore(userDataPath);
    await accountStore.load();
    await usageStore.load();
    await preferencesStore.load();
    await accountSettingsStore.load();
    await promptHistoryStore.load();
    await promptTemplateStore.load();
    await scheduleStore.load();
    await researchStore.load();
    await geoStudyStore.load();
    dataProtectionSettings = preferencesStore.get().dataProtectionByService;
    configureAutoUpdater();
    registerIpcHandlers();
    await createMainWindow();
    const updateCheckTimer = setTimeout(() => {
      void checkForApplicationUpdates().catch((error: unknown) => {
        console.error("Unable to perform the startup update check.", error);
      });
    }, 15_000);
    updateCheckTimer.unref();
    scheduleTimer = setInterval(() => {
      void runDueSchedules().catch((error: unknown) => {
        console.error("Unable to execute scheduled prompts.", error);
      });
    }, 15_000);
    void runDueSchedules().catch((error: unknown) => {
      console.error("Unable to execute scheduled prompts.", error);
    });

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        void createMainWindow();
      }
    });
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
      app.quit();
    }
  });

  app.on("before-quit", (event) => {
    if (isInstallingUpdate) {
      return;
    }
    if (!isRendererCloseConfirmed) {
      event.preventDefault();
      isQuitRequested = true;
      requestRendererCloseConfirmation();
      return;
    }
    if (isFinalizingQuit) {
      return;
    }
    event.preventDefault();
    isFinalizingQuit = true;
    if (scheduleTimer) {
      clearInterval(scheduleTimer);
      scheduleTimer = null;
    }
    void persistApplicationState("AI Workspace is closing.")
      .catch((error: unknown) => {
        console.error("Unable to persist final usage.", error);
      })
      .finally(() => app.exit(0));
  });
}
