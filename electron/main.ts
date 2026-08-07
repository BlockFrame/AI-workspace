import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  session,
  shell,
  WebContentsView
} from "electron";
import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { scanSensitiveData } from "../src/shared/sensitive-data";
import { SERVICE_BY_ID, isServiceId } from "../src/shared/services";
import type {
  AccountProfile,
  BroadcastDeliveryResult,
  BroadcastMode,
  BroadcastRequest,
  BroadcastResult,
  DataProtectionSettings,
  RemoveAccountResult,
  ResetUsageResult,
  ServiceId,
  ServiceUsageSummary,
  UsagePeriodDays,
  UsageSummary,
  ViewBounds,
  ViewState
} from "../src/shared/types";

const MAX_WARM_VIEWS = 3;
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

interface BroadcastAdapter {
  composerSelectors: readonly string[];
  sendSelectors: readonly string[];
  deepResearchLabels: readonly string[];
  deepResearchOpeners: readonly string[];
  researchModeName: string;
}

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

let mainWindow: BrowserWindow | null = null;
let accountStore: AccountStore;
let usageStore: UsageStore;
let activeAccountId: string | null = null;
let activeUsageStartedAt: number | null = null;
let activeBounds: ViewBounds = { x: 280, y: 56, width: 920, height: 744 };
let isActiveViewVisible = true;
const managedViews = new Map<string, ManagedView>();
const configuredPartitions = new Set<string>();
let isFinalizingQuit = false;

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
  const platformToken =
    process.platform === "darwin"
      ? "Macintosh; Intel Mac OS X 10_15_7"
      : "Windows NT 10.0; Win64; x64";
  view.webContents.setUserAgent(
    `Mozilla/5.0 (${platformToken}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${process.versions.chrome} Safari/537.36`
  );

  const managedView: ManagedView = {
    accountId: account.id,
    serviceId: account.serviceId,
    partition,
    view,
    lastActivatedAt: Date.now(),
    attached: false
  };
  attachNavigationGuards(managedView);
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
    !isBroadcastMode(candidate.mode)
  ) {
    return null;
  }
  const prompt = candidate.prompt.trim();
  const accountIds = [...new Set(candidate.accountIds)];
  if (prompt.length < 1 || prompt.length > 12_000 || accountIds.length < 1) {
    return null;
  }
  return { accountIds, prompt, mode: candidate.mode };
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
  mode: BroadcastMode
): string {
  const payload = JSON.stringify({ adapter, prompt, mode });
  return `
    (async () => {
      const { adapter, prompt, mode } = ${payload};
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
      await pause(450);
      let sendButton = null;
      for (const selector of adapter.sendSelectors) {
        sendButton = [...document.querySelectorAll(selector)]
          .find((element) => visible(element) && !element.disabled);
        if (sendButton) break;
      }
      if (!sendButton) {
        return {
          status: "failed",
          message: "The prompt was prepared, but the provider's Send control was not found."
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

async function deliverBroadcast(
  account: AccountProfile,
  prompt: string,
  mode: BroadcastMode
): Promise<BroadcastDeliveryResult> {
  let managedView = managedViews.get(account.id);
  if (!managedView || managedView.view.webContents.isDestroyed()) {
    managedView = createManagedView(account);
    managedViews.set(account.id, managedView);
  }
  managedView.lastActivatedAt = Date.now();
  try {
    await waitForViewReady(managedView);
    const adapter = BROADCAST_ADAPTERS[account.serviceId];
    const result: unknown = await managedView.view.webContents.executeJavaScript(
      buildBroadcastScript(adapter, prompt, mode),
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
    .filter((managedView) => managedView.accountId !== activeAccountId)
    .sort((left, right) => left.lastActivatedAt - right.lastActivatedAt);

  while (managedViews.size > MAX_WARM_VIEWS && candidates.length > 0) {
    const candidate = candidates.shift();
    if (candidate) {
      destroyManagedView(candidate.accountId);
    }
  }
}

async function selectAccount(accountId: string): Promise<void> {
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

function registerIpcHandlers(): void {
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
    const accounts = await accountStore.remove(accountId);
    const response: RemoveAccountResult = { removed: true, accounts };
    return response;
  });

  ipcMain.handle("views:select", async (_event, accountId: unknown) => {
    if (typeof accountId !== "string") {
      throw new Error("Invalid account identifier.");
    }
    await selectAccount(accountId);
  });

  ipcMain.on("views:set-bounds", (_event, value: unknown) => {
    const bounds = normalizeBounds(value);
    if (!bounds) {
      return;
    }
    activeBounds = bounds;
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

  ipcMain.handle("data-protection:set", async (_event, value: unknown) => {
    const settings = normalizeDataProtectionSettings(value);
    if (!settings) {
      throw new Error("Invalid data protection settings.");
    }
    dataProtectionSettings = settings;
    await Promise.all([...managedViews.values()].map(applyDataProtectionToView));
  });

  ipcMain.handle("broadcast:send", async (_event, value: unknown) => {
    const request = normalizeBroadcastRequest(value);
    if (!request) {
      throw new Error("Choose 1-8 accounts and enter a prompt of up to 12,000 characters.");
    }
    const accounts: AccountProfile[] = [];
    for (const accountId of request.accountIds) {
      const account = accountStore.get(accountId);
      if (!account) {
        throw new Error("One or more selected accounts no longer exist.");
      }
      accounts.push(account);
    }
    const deliveries = await Promise.all(
      accounts.map((account) => deliverBroadcast(account, request.prompt, request.mode))
    );
    enforceWarmViewLimit();
    const response: BroadcastResult = { deliveries };
    return response;
  });
}

async function createMainWindow(): Promise<void> {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 680,
    show: false,
    backgroundColor: "#0b0d12",
    title: "AI Workspace",
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true
    }
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    openExternalHttps(url);
    return { action: "deny" };
  });

  mainWindow.once("ready-to-show", () => mainWindow?.show());
  mainWindow.on("focus", () => beginActiveUsage());
  mainWindow.on("blur", () => {
    void flushActiveUsage().catch((error: unknown) => {
      console.error("Unable to persist active usage.", error);
    });
  });
  mainWindow.on("close", () => {
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
      mainWindow.focus();
    }
  });

  app.whenReady().then(async () => {
    accountStore = new AccountStore(app.getPath("userData"));
    usageStore = new UsageStore(app.getPath("userData"));
    await accountStore.load();
    await usageStore.load();
    registerIpcHandlers();
    await createMainWindow();

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
    if (isFinalizingQuit) {
      return;
    }
    event.preventDefault();
    isFinalizingQuit = true;
    void flushActiveUsage()
      .then(() => usageStore.waitForPendingSaves())
      .catch((error: unknown) => {
        console.error("Unable to persist final usage.", error);
      })
      .finally(() => app.exit(0));
  });
}
