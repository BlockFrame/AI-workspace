import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import claudeLogo from "@lobehub/icons-static-svg/icons/claude-color.svg";
import deepSeekLogo from "@lobehub/icons-static-svg/icons/deepseek-color.svg";
import geminiLogo from "@lobehub/icons-static-svg/icons/gemini-color.svg";
import kimiLogo from "@lobehub/icons-static-svg/icons/kimi-color.svg";
import mistralLogo from "@lobehub/icons-static-svg/icons/mistral-color.svg";
import openAiLogo from "@lobehub/icons-static-svg/icons/openai.svg";
import perplexityLogo from "@lobehub/icons-static-svg/icons/perplexity-color.svg";
import zaiLogo from "@lobehub/icons-static-svg/icons/zai.svg";
import { scanSensitiveData } from "../shared/sensitive-data";
import type { SensitiveDataFinding } from "../shared/sensitive-data";
import { SERVICES, SERVICE_BY_ID } from "../shared/services";
import { ResearchWorkspace } from "./ResearchWorkspace";
import { UseCasesWorkspace } from "./UseCasesWorkspace";
import type {
  AccountProfile,
  AccountProviderSettings,
  AppPreferences,
  BroadcastDeliveryResult,
  BroadcastMode,
  PromptHistoryEntry,
  PromptTemplate,
  PromptTemplateInput,
  ScheduledPrompt,
  ScheduleRecurrence,
  ServiceId,
  UsagePeriodDays,
  UsageSummary,
  ViewState
} from "../shared/types";

type IconName =
  | "arrow-left"
  | "arrow-right"
  | "check"
  | "chart"
  | "clock"
  | "chevron-down"
  | "chevron-right"
  | "external"
  | "eye"
  | "lock"
  | "moon"
  | "history"
  | "grid"
  | "keyboard"
  | "plus"
  | "refresh"
  | "send"
  | "settings"
  | "shield"
  | "sparkles"
  | "type"
  | "trash"
  | "users"
  | "x";

type SettingsPage =
  | "preferences"
  | "accounts"
  | "templates"
  | "memory"
  | "automation"
  | "shortcuts"
  | "data-protection"
  | "usage";

const DEFAULT_DATA_PROTECTION_SETTINGS: AppPreferences["dataProtectionByService"] = {
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
  dataProtectionByService: DEFAULT_DATA_PROTECTION_SETTINGS
};

function trapDialogFocus(event: React.KeyboardEvent<HTMLElement>) {
  if (event.key !== "Tab") {
    return;
  }
  const focusable = [
    ...event.currentTarget.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )
  ];
  const first = focusable[0];
  const last = focusable.at(-1);
  if (!first || !last) {
    return;
  }
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

function formatUsageDuration(activeMs: number): string {
  const totalMinutes = Math.floor(activeMs / 60_000);
  if (totalMinutes < 1) {
    return activeMs > 0 ? "< 1 min" : "0 min";
  }
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes} min`;
}

const SERVICE_NUMBER = new Map(
  SERVICES.map((service, index) => [service.id, index + 1])
);
const MAX_BROADCAST_TARGETS = 8;
const DISMISSED_AUTH_GUIDANCE_KEY = "ai-workspace:dismissed-auth-guidance";

const SETTINGS_TABS: ReadonlyArray<{
  page: SettingsPage;
  label: string;
  icon: IconName;
}> = [
  { page: "preferences", label: "Preferences", icon: "settings" },
  { page: "accounts", label: "Accounts", icon: "sparkles" },
  { page: "templates", label: "Templates", icon: "type" },
  { page: "memory", label: "Memory", icon: "history" },
  { page: "automation", label: "Automation", icon: "clock" },
  { page: "shortcuts", label: "Shortcuts", icon: "keyboard" },
  { page: "data-protection", label: "Protection", icon: "shield" },
  { page: "usage", label: "Usage", icon: "chart" }
];

function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  const paths: Record<IconName, React.ReactNode> = {
    "arrow-left": <path d="m15 18-6-6 6-6" />,
    "arrow-right": <path d="m9 18 6-6-6-6" />,
    check: <path d="m5 12 4 4L19 6" />,
    chart: (
      <>
        <path d="M4 20V10" />
        <path d="M10 20V4" />
        <path d="M16 20v-7" />
        <path d="M22 20H2" />
      </>
    ),
    clock: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </>
    ),
    "chevron-down": <path d="m6 9 6 6 6-6" />,
    "chevron-right": <path d="m9 18 6-6-6-6" />,
    external: (
      <>
        <path d="M15 3h6v6" />
        <path d="M10 14 21 3" />
        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      </>
    ),
    eye: (
      <>
        <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
        <circle cx="12" cy="12" r="3" />
      </>
    ),
    lock: (
      <>
        <rect width="16" height="12" x="4" y="10" rx="2" />
        <path d="M8 10V7a4 4 0 0 1 8 0v3" />
      </>
    ),
    moon: <path d="M21 12.8A8.5 8.5 0 1 1 11.2 3 6.5 6.5 0 0 0 21 12.8Z" />,
    history: (
      <>
        <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
        <path d="M3 3v5h5M12 7v5l3 2" />
      </>
    ),
    grid: (
      <>
        <rect x="3" y="3" width="7" height="7" rx="1.5" />
        <rect x="14" y="3" width="7" height="7" rx="1.5" />
        <rect x="3" y="14" width="7" height="7" rx="1.5" />
        <rect x="14" y="14" width="7" height="7" rx="1.5" />
      </>
    ),
    keyboard: (
      <>
        <rect x="2" y="5" width="20" height="14" rx="2" />
        <path d="M6 9h.01M10 9h.01M14 9h.01M18 9h.01M6 13h.01M10 13h8M6 17h12" />
      </>
    ),
    plus: (
      <>
        <path d="M12 5v14" />
        <path d="M5 12h14" />
      </>
    ),
    refresh: (
      <>
        <path d="M20 11a8.1 8.1 0 0 0-15.5-2M4 4v5h5" />
        <path d="M4 13a8.1 8.1 0 0 0 15.5 2M20 20v-5h-5" />
      </>
    ),
    send: (
      <>
        <path d="m22 2-7 20-4-9-9-4Z" />
        <path d="M22 2 11 13" />
      </>
    ),
    settings: (
      <>
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1a1.7 1.7 0 0 0 1.9.3A1.7 1.7 0 0 0 10 3V2.8h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z" />
      </>
    ),
    shield: (
      <>
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
        <path d="m9 12 2 2 4-4" />
      </>
    ),
    sparkles: (
      <>
        <path d="m12 3-1.4 3.6L7 8l3.6 1.4L12 13l1.4-3.6L17 8l-3.6-1.4Z" />
        <path d="m5 14-.9 2.1L2 17l2.1.9L5 20l.9-2.1L8 17l-2.1-.9Z" />
        <path d="m19 13-.7 1.3L17 15l1.3.7L19 17l.7-1.3L21 15l-1.3-.7Z" />
      </>
    ),
    type: (
      <>
        <path d="M4 7V4h16v3" />
        <path d="M9 20h6" />
        <path d="M12 4v16" />
      </>
    ),
    trash: (
      <>
        <path d="M3 6h18" />
        <path d="M8 6V4h8v2" />
        <path d="m19 6-1 15H6L5 6" />
      </>
    ),
    users: (
      <>
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </>
    ),
    x: (
      <>
        <path d="m18 6-12 12" />
        <path d="m6 6 12 12" />
      </>
    )
  };

  return (
    <svg
      aria-hidden="true"
      fill="none"
      height={size}
      viewBox="0 0 24 24"
      width={size}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.8"
    >
      {paths[name]}
    </svg>
  );
}

function ServiceLogo({
  serviceId,
  size = "medium"
}: {
  serviceId: ServiceId;
  size?: "small" | "medium" | "large";
}) {
  const service = SERVICE_BY_ID.get(serviceId);
  const logoByService: Record<ServiceId, string> = {
    chatgpt: openAiLogo,
    claude: claudeLogo,
    perplexity: perplexityLogo,
    gemini: geminiLogo,
    zai: zaiLogo,
    deepseek: deepSeekLogo,
    kimi: kimiLogo,
    mistral: mistralLogo
  };
  return (
    <span
      aria-label={service?.name}
      className={`service-logo service-${serviceId} service-logo-${size}`}
      role="img"
    >
      <img alt="" src={logoByService[serviceId]} />
    </span>
  );
}

function sortAccounts(accounts: AccountProfile[]): AccountProfile[] {
  return [...accounts].sort(
    (left, right) =>
      new Date(right.lastUsedAt).getTime() - new Date(left.lastUsedAt).getTime()
  );
}

function formatHost(url: string): string {
  if (!url) {
    return "Connecting...";
  }
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function defaultAccountSettings(accountId: string): AccountProviderSettings {
  return {
    accountId,
    defaultBroadcastMode: "standard",
    contextNote: "",
    includeContextInPrompts: false,
    zoomPercent: 100,
    updatedAt: new Date(0).toISOString()
  };
}

function toDateTimeInput(date: Date): string {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function formatDateTime(value: string | null | undefined): string {
  return value
    ? new Intl.DateTimeFormat(undefined, {
        dateStyle: "medium",
        timeStyle: "short"
      }).format(new Date(value))
    : "No future run";
}

const TEMPLATE_PLACEHOLDER = /\{\{([A-Za-z_][A-Za-z0-9_]{0,63})\}\}/g;

function emptyTemplateValues(): Record<string, string> {
  return Object.create(null) as Record<string, string>;
}

function getTemplateValue(
  values: Readonly<Record<string, string>>,
  variable: string
): string | undefined {
  if (!Object.prototype.hasOwnProperty.call(values, variable)) {
    return undefined;
  }
  const value: unknown = values[variable];
  return typeof value === "string" ? value : undefined;
}

function extractTemplateVariables(content: string): string[] {
  const variables = new Set<string>();
  for (const match of content.matchAll(TEMPLATE_PLACEHOLDER)) {
    const variable = match[1];
    if (variable) {
      variables.add(variable);
    }
  }
  return [...variables];
}

function renderPromptTemplate(
  content: string,
  values: Readonly<Record<string, string>>
): string {
  return content.replace(TEMPLATE_PLACEHOLDER, (placeholder, variable: string) => {
    const value = getTemplateValue(values, variable);
    return value?.trim() ? value : placeholder;
  });
}

function emptyTemplateInput(): PromptTemplateInput {
  return { name: "", category: "", description: "", content: "" };
}

function loadDismissedAuthGuidance(): string[] {
  try {
    const stored: unknown = JSON.parse(
      window.localStorage.getItem(DISMISSED_AUTH_GUIDANCE_KEY) ?? "[]"
    );
    return Array.isArray(stored)
      ? stored.filter((value): value is string => typeof value === "string")
      : [];
  } catch {
    console.warn("Unable to read dismissed provider sign-in guidance.");
    return [];
  }
}

export default function App() {
  const [accounts, setAccounts] = useState<AccountProfile[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [viewState, setViewState] = useState<ViewState | null>(null);
  const [connectServiceId, setConnectServiceId] = useState<ServiceId | null>(null);
  const [accountLabel, setAccountLabel] = useState("");
  const [isBooting, setIsBooting] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isBroadcastOpen, setIsBroadcastOpen] = useState(false);
  const [isResearchOpen, setIsResearchOpen] = useState(false);
  const [isUseCasesOpen, setIsUseCasesOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(
    () => window.innerWidth < 900
  );
  const [isAccountListOpen, setIsAccountListOpen] = useState(false);
  const [dismissedAuthGuidance, setDismissedAuthGuidance] = useState<string[]>(
    loadDismissedAuthGuidance
  );
  const [broadcastMode, setBroadcastMode] = useState<BroadcastMode>("standard");
  const [broadcastPrompt, setBroadcastPrompt] = useState("");
  const [broadcastAccountIds, setBroadcastAccountIds] = useState<string[]>([]);
  const [broadcastResults, setBroadcastResults] = useState<BroadcastDeliveryResult[]>([]);
  const [broadcastError, setBroadcastError] = useState<string | null>(null);
  const [broadcastTiming, setBroadcastTiming] = useState<"now" | "scheduled">("now");
  const [scheduleAt, setScheduleAt] = useState(() =>
    toDateTimeInput(new Date(Date.now() + 3_600_000))
  );
  const [scheduleRecurrence, setScheduleRecurrence] =
    useState<ScheduleRecurrence>("once");
  const [sensitiveFindings, setSensitiveFindings] = useState<SensitiveDataFinding[]>([]);
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [settingsPage, setSettingsPage] = useState<SettingsPage>("preferences");
  const [usagePeriod, setUsagePeriod] = useState<UsagePeriodDays>(7);
  const [usageSummary, setUsageSummary] = useState<UsageSummary | null>(null);
  const [isUsageLoading, setIsUsageLoading] = useState(false);
  const [isUsageExporting, setIsUsageExporting] = useState(false);
  const [usageError, setUsageError] = useState<string | null>(null);
  const [preferences, setPreferences] = useState<AppPreferences>(DEFAULT_PREFERENCES);
  const [preferencesLoaded, setPreferencesLoaded] = useState(false);
  const [accountSettings, setAccountSettings] = useState<AccountProviderSettings[]>([]);
  const [settingsAccountId, setSettingsAccountId] = useState<string>("");
  const [promptHistory, setPromptHistory] = useState<PromptHistoryEntry[]>([]);
  const [promptTemplates, setPromptTemplates] = useState<PromptTemplate[]>([]);
  const [templateSearch, setTemplateSearch] = useState("");
  const [templateFormMode, setTemplateFormMode] = useState<"create" | "edit" | null>(
    null
  );
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [templateDraft, setTemplateDraft] = useState<PromptTemplateInput>(
    emptyTemplateInput
  );
  const [isSavingTemplate, setIsSavingTemplate] = useState(false);
  const [broadcastTemplateId, setBroadcastTemplateId] = useState("");
  const [broadcastTemplateValues, setBroadcastTemplateValues] = useState<
    Record<string, string>
  >(emptyTemplateValues);
  const [broadcastTemplateError, setBroadcastTemplateError] = useState<string | null>(
    null
  );
  const [schedules, setSchedules] = useState<ScheduledPrompt[]>([]);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [settingsMessage, setSettingsMessage] = useState<string | null>(null);
  const [systemDark, setSystemDark] = useState(
    () => window.matchMedia("(prefers-color-scheme: dark)").matches
  );
  const [error, setError] = useState<string | null>(null);
  const workspaceRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const settingsCloseRef = useRef<HTMLButtonElement>(null);
  const settingsButtonRef = useRef<HTMLButtonElement>(null);
  const broadcastButtonRef = useRef<HTMLButtonElement>(null);
  const researchButtonRef = useRef<HTMLButtonElement>(null);
  const useCasesButtonRef = useRef<HTMLButtonElement>(null);
  const broadcastCloseRef = useRef<HTMLButtonElement>(null);
  const broadcastPromptRef = useRef<HTMLTextAreaElement>(null);
  const templateNameRef = useRef<HTMLInputElement>(null);
  const researchCloseHandlerRef = useRef<(() => Promise<boolean>) | null>(null);
  const useCasesCloseHandlerRef = useRef<(() => Promise<boolean>) | null>(null);

  const isConnectDialogOpen = connectServiceId !== null;
  const isOverlayOpen =
    isConnectDialogOpen ||
    isSettingsOpen ||
    isBroadcastOpen ||
    isResearchOpen ||
    isUseCasesOpen;
  const effectiveTheme =
    preferences.theme === "system"
      ? systemDark
        ? "dark"
        : "light"
      : preferences.theme;
  const selectedAccount = useMemo(
    () => accounts.find((account) => account.id === selectedAccountId),
    [accounts, selectedAccountId]
  );
  const selectedSettingsAccount = useMemo(
    () => accounts.find((account) => account.id === settingsAccountId),
    [accounts, settingsAccountId]
  );
  const showPerplexityAuthGuidance =
    selectedAccount?.serviceId === "perplexity" &&
    !dismissedAuthGuidance.includes(selectedAccount.id);

  const dismissAuthGuidance = () => {
    if (!selectedAccount) {
      return;
    }
    setDismissedAuthGuidance((current) => {
      const next = [...new Set([...current, selectedAccount.id])];
      try {
        window.localStorage.setItem(DISMISSED_AUTH_GUIDANCE_KEY, JSON.stringify(next));
      } catch (storageError) {
        console.error("Unable to save dismissed provider sign-in guidance.", storageError);
      }
      return next;
    });
  };

  useEffect(() => {
    const compactLayout = window.matchMedia("(max-width: 899px)");
    const handleCompactLayout = (event: MediaQueryListEvent) => {
      if (event.matches) {
        setIsSidebarCollapsed(true);
      }
    };
    compactLayout.addEventListener("change", handleCompactLayout);
    return () => compactLayout.removeEventListener("change", handleCompactLayout);
  }, []);
  const selectedAccountSettings = useMemo(
    () =>
      accountSettings.find((settings) => settings.accountId === settingsAccountId) ??
      (settingsAccountId ? defaultAccountSettings(settingsAccountId) : null),
    [accountSettings, settingsAccountId]
  );
  const broadcastTargetLimitReached =
    broadcastAccountIds.length >= MAX_BROADCAST_TARGETS;
  const selectedBroadcastTemplate = useMemo(
    () => promptTemplates.find((template) => template.id === broadcastTemplateId),
    [broadcastTemplateId, promptTemplates]
  );
  const broadcastTemplateVariables = useMemo(
    () =>
      selectedBroadcastTemplate
        ? extractTemplateVariables(selectedBroadcastTemplate.content)
        : [],
    [selectedBroadcastTemplate]
  );
  const missingBroadcastTemplateVariables = broadcastTemplateVariables.filter(
    (variable) => !getTemplateValue(broadcastTemplateValues, variable)?.trim()
  );
  const renderedTemplatePreview = selectedBroadcastTemplate
    ? renderPromptTemplate(selectedBroadcastTemplate.content, broadcastTemplateValues)
    : "";
  const filteredPromptTemplates = useMemo(() => {
    const query = templateSearch.trim().toLocaleLowerCase();
    if (!query) {
      return promptTemplates;
    }
    return promptTemplates.filter((template) =>
      [template.name, template.category, template.description, template.content]
        .filter((value): value is string => Boolean(value))
        .some((value) => value.toLocaleLowerCase().includes(query))
    );
  }, [promptTemplates, templateSearch]);

  const selectAccount = useCallback(async (accountId: string) => {
    setError(null);
    setSelectedAccountId(accountId);
    setViewState(null);
    try {
      setAccounts(await window.desktop.selectAccount(accountId));
    } catch (selectionError) {
      setError(
        selectionError instanceof Error
          ? selectionError.message
          : "Unable to open this account."
      );
    }
  }, []);

  const selectRecentProvider = useCallback(async (serviceId: ServiceId) => {
    setError(null);
    setViewState(null);
    try {
      const result = await window.desktop.selectRecentAccount(serviceId);
      setAccounts(result.accounts);
      setSelectedAccountId(result.accountId);
    } catch (selectionError) {
      setError(
        selectionError instanceof Error
          ? selectionError.message
          : "Unable to open this provider."
      );
    }
  }, []);

  const closeConnectDialog = useCallback(() => {
    if (isConnecting) {
      return;
    }
    setConnectServiceId(null);
    setAccountLabel("");
  }, [isConnecting]);

  const openConnectDialog = useCallback((serviceId: ServiceId = "chatgpt") => {
    setConnectServiceId(serviceId);
    setAccountLabel("");
    setError(null);
  }, []);

  const closeSettings = useCallback(() => {
    setIsSettingsOpen(false);
    requestAnimationFrame(() => settingsButtonRef.current?.focus());
  }, []);

  const openSettings = useCallback((page: SettingsPage = "preferences") => {
    setSettingsPage(page);
    setSettingsError(null);
    setSettingsMessage(null);
    setIsSettingsOpen(true);
  }, []);

  const openBroadcast = useCallback(() => {
    setBroadcastAccountIds(
      sortAccounts(accounts).slice(0, MAX_BROADCAST_TARGETS).map((account) => account.id)
    );
    const activeSettings = accountSettings.find(
      (settings) => settings.accountId === selectedAccountId
    );
    setBroadcastMode(activeSettings?.defaultBroadcastMode ?? "standard");
    setBroadcastTiming("now");
    setScheduleAt(toDateTimeInput(new Date(Date.now() + 3_600_000)));
    setBroadcastResults([]);
    setBroadcastError(null);
    setBroadcastTemplateId("");
    setBroadcastTemplateValues(emptyTemplateValues());
    setBroadcastTemplateError(null);
    setSensitiveFindings([]);
    setIsBroadcastOpen(true);
  }, [accountSettings, accounts, selectedAccountId]);

  const closeBroadcast = useCallback(() => {
    if (isBroadcasting) {
      return;
    }
    setIsBroadcastOpen(false);
    void window.desktop.releaseBroadcastViews();
    requestAnimationFrame(() => broadcastButtonRef.current?.focus());
  }, [isBroadcasting]);

  const closeResearch = useCallback(() => {
    setIsResearchOpen(false);
    void window.desktop.releaseBroadcastViews();
    requestAnimationFrame(() => researchButtonRef.current?.focus());
  }, []);

  const closeUseCases = useCallback(() => {
    setIsUseCasesOpen(false);
    requestAnimationFrame(() => useCasesButtonRef.current?.focus());
  }, []);

  const loadUsageSummary = useCallback(async (periodDays: UsagePeriodDays) => {
    setIsUsageLoading(true);
    setUsageError(null);
    try {
      setUsageSummary(await window.desktop.getUsageSummary(periodDays));
    } catch (loadError) {
      setUsageError(
        loadError instanceof Error ? loadError.message : "Unable to load usage data."
      );
    } finally {
      setIsUsageLoading(false);
    }
  }, []);

  const exportUsageCsv = async () => {
    setIsUsageExporting(true);
    setUsageError(null);
    setSettingsMessage(null);
    try {
      const result = await window.desktop.exportUsageCsv(usagePeriod);
      setSettingsMessage(
        result.status === "saved"
          ? `Usage CSV saved with ${result.rowCount} data rows.`
          : "Usage CSV export cancelled."
      );
    } catch (exportError) {
      setUsageError(
        exportError instanceof Error ? exportError.message : "Unable to export usage data."
      );
    } finally {
      setIsUsageExporting(false);
    }
  };

  useEffect(() => {
    let disposed = false;
    void Promise.all([
      window.desktop.listAccounts(),
      window.desktop.getPreferences(),
      window.desktop.listAccountSettings(),
      window.desktop.listPromptHistory(),
      window.desktop.listPromptTemplates(),
      window.desktop.listSchedules()
    ])
      .then(
        ([
          storedAccounts,
          storedPreferences,
          storedAccountSettings,
          storedHistory,
          storedTemplates,
          storedSchedules
        ]) => {
        if (disposed) {
          return;
        }
        setAccounts(storedAccounts);
        setPreferences(storedPreferences);
        setPreferencesLoaded(true);
        setAccountSettings(storedAccountSettings);
        setPromptHistory(storedHistory);
        setPromptTemplates(storedTemplates);
        setSchedules(storedSchedules);
        const firstAccount = sortAccounts(storedAccounts)[0];
        if (firstAccount) {
          setSettingsAccountId(firstAccount.id);
          void selectAccount(firstAccount.id);
        }
        }
      )
      .catch((loadError: unknown) => {
        if (!disposed) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Unable to load your accounts."
          );
        }
      })
      .finally(() => {
        if (!disposed) {
          setIsBooting(false);
        }
      });

    return () => {
      disposed = true;
    };
  }, [selectAccount]);

  useEffect(() => window.desktop.onViewState(setViewState), []);
  useEffect(
    () =>
      window.desktop.onAppBeforeClose(() => {
        const handlers = [
          researchCloseHandlerRef.current,
          useCasesCloseHandlerRef.current
        ].filter(
          (handler): handler is () => Promise<boolean> => handler !== null
        );
        void handlers
          .reduce(
            async (canContinue, handler) =>
              (await canContinue) ? handler() : false,
            Promise.resolve(true)
          )
          .then((canClose) => {
            if (canClose) {
              window.desktop.confirmAppClose();
            } else {
              window.desktop.cancelAppClose();
            }
          });
      }),
    []
  );
  useEffect(() => window.desktop.onSchedulesChanged(setSchedules), []);
  useEffect(() => window.desktop.onPreferencesChanged(setPreferences), []);
  useEffect(
    () =>
      window.desktop.onProviderShortcut((serviceId) => {
        void selectRecentProvider(serviceId);
      }),
    [selectRecentProvider]
  );

  useEffect(() => {
    window.desktop.setViewVisible(!isOverlayOpen);
    if (isConnectDialogOpen) {
      requestAnimationFrame(() => inputRef.current?.focus());
    } else if (isSettingsOpen) {
      requestAnimationFrame(() => settingsCloseRef.current?.focus());
    } else if (isBroadcastOpen) {
      requestAnimationFrame(() => broadcastPromptRef.current?.focus());
    }
    return () => window.desktop.setViewVisible(true);
  }, [
    isBroadcastOpen,
    isConnectDialogOpen,
    isOverlayOpen,
    isResearchOpen,
    isUseCasesOpen,
    isSettingsOpen
  ]);

  useEffect(() => {
    const darkModeQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const updateSystemTheme = (event: MediaQueryListEvent) => setSystemDark(event.matches);
    darkModeQuery.addEventListener("change", updateSystemTheme);
    return () => darkModeQuery.removeEventListener("change", updateSystemTheme);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = effectiveTheme;
    root.dataset.textSize = preferences.textSize;
    root.dataset.contrast = preferences.highContrast ? "high" : "normal";
    root.dataset.motion = preferences.reducedMotion ? "reduced" : "full";
    root.style.colorScheme = effectiveTheme;
  }, [effectiveTheme, preferences]);

  useEffect(() => {
    if (!preferencesLoaded) {
      return;
    }
    const timeout = window.setTimeout(() => {
      void window.desktop.setPreferences(preferences).catch((preferenceError: unknown) => {
        console.error("Unable to persist preferences.", preferenceError);
      });
    }, 150);
    return () => window.clearTimeout(timeout);
  }, [preferences, preferencesLoaded]);

  useEffect(() => {
    const workspace = workspaceRef.current;
    if (!workspace) {
      return;
    }
    const reportBounds = () => {
      const bounds = workspace.getBoundingClientRect();
      window.desktop.setViewBounds({
        x: bounds.x,
        y: bounds.y,
        width: bounds.width,
        height: bounds.height
      });
    };
    const observer = new ResizeObserver(reportBounds);
    observer.observe(workspace);
    window.addEventListener("resize", reportBounds);
    const animationFrame = requestAnimationFrame(reportBounds);
    return () => {
      cancelAnimationFrame(animationFrame);
      observer.disconnect();
      window.removeEventListener("resize", reportBounds);
    };
  }, [preferences.appZoomPercent, selectedAccountId]);

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if (event.key === "Escape" && isConnectDialogOpen) {
        closeConnectDialog();
        return;
      }
      if (event.key === "Escape" && isSettingsOpen) {
        closeSettings();
        return;
      }
      if (event.key === "Escape" && isBroadcastOpen) {
        closeBroadcast();
        return;
      }
      if (!(event.metaKey || event.ctrlKey) || event.altKey) {
        return;
      }
      if (event.key === ",") {
        event.preventDefault();
        openSettings();
        return;
      }
      if (event.key.toLowerCase() === "n") {
        event.preventDefault();
        openConnectDialog();
        return;
      }
      const service = SERVICES[Number(event.key) - 1];
      if (!service) {
        return;
      }
      if (accounts.some((account) => account.serviceId === service.id)) {
        event.preventDefault();
        void selectRecentProvider(service.id);
      }
    };
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, [
    accounts,
    closeConnectDialog,
    closeBroadcast,
    closeSettings,
    isConnectDialogOpen,
    isBroadcastOpen,
    isSettingsOpen,
    openConnectDialog,
    openSettings,
    selectRecentProvider
  ]);

  useEffect(() => {
    if (isSettingsOpen && settingsPage === "usage") {
      void loadUsageSummary(usagePeriod);
    }
  }, [isSettingsOpen, loadUsageSummary, settingsPage, usagePeriod]);

  useEffect(() => {
    if (isSettingsOpen && settingsPage === "templates" && templateFormMode) {
      requestAnimationFrame(() => templateNameRef.current?.focus());
    }
  }, [isSettingsOpen, settingsPage, templateFormMode, editingTemplateId]);

  useEffect(() => {
    if (!isSettingsOpen) {
      return;
    }
    if (settingsPage === "automation") {
      void window.desktop.listSchedules().then(setSchedules).catch((loadError: unknown) => {
        setSettingsError(
          loadError instanceof Error ? loadError.message : "Unable to load schedules."
        );
      });
    } else if (settingsPage === "memory") {
      void window.desktop.listPromptHistory().then(setPromptHistory).catch((loadError: unknown) => {
        setSettingsError(
          loadError instanceof Error ? loadError.message : "Unable to load prompt history."
        );
      });
    } else if (settingsPage === "templates") {
      void window.desktop.listPromptTemplates().then(setPromptTemplates).catch((loadError: unknown) => {
        setSettingsError(
          loadError instanceof Error ? loadError.message : "Unable to load prompt templates."
        );
      });
    }
  }, [isSettingsOpen, settingsPage]);

  const addAccount = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!connectServiceId || !accountLabel.trim()) {
      return;
    }
    setError(null);
    setIsConnecting(true);
    try {
      const previousIds = new Set(accounts.map((account) => account.id));
      const updatedAccounts = await window.desktop.addAccount(
        connectServiceId,
        accountLabel.trim()
      );
      const addedAccount = updatedAccounts.find((account) => !previousIds.has(account.id));
      setAccounts(updatedAccounts);
      setConnectServiceId(null);
      setAccountLabel("");
      if (addedAccount) {
        setAccountSettings((current) => [
          ...current,
          defaultAccountSettings(addedAccount.id)
        ]);
        setSettingsAccountId(addedAccount.id);
        await selectAccount(addedAccount.id);
      }
    } catch (addError) {
      setError(
        addError instanceof Error
          ? addError.message
          : "Unable to add this account."
      );
    } finally {
      setIsConnecting(false);
    }
  };

  const removeAccount = async (event: React.MouseEvent, accountId: string) => {
    event.stopPropagation();
    setError(null);
    try {
      const result = await window.desktop.removeAccount(accountId);
      if (!result.removed) {
        return;
      }
      setAccounts(result.accounts);
      setAccountSettings((current) =>
        current.filter((settings) => settings.accountId !== accountId)
      );
      setBroadcastAccountIds((current) => current.filter((id) => id !== accountId));
      setBroadcastResults((current) =>
        current.filter((delivery) => delivery.accountId !== accountId)
      );
      if (settingsAccountId === accountId) {
        setSettingsAccountId(sortAccounts(result.accounts)[0]?.id ?? "");
      }
      if (selectedAccountId === accountId) {
        const nextAccount = sortAccounts(result.accounts)[0];
        setSelectedAccountId(nextAccount?.id ?? null);
        setViewState(null);
        if (nextAccount) {
          await selectAccount(nextAccount.id);
        }
      }
    } catch (removeError) {
      setError(
        removeError instanceof Error
          ? removeError.message
          : "Unable to remove this account."
      );
    }
  };

  const runBrowserAction = async (action: () => Promise<void>) => {
    setError(null);
    try {
      await action();
    } catch (actionError) {
      setError(
        actionError instanceof Error
          ? actionError.message
          : "This action is not available."
      );
    }
  };

  const sendBroadcast = async (allowSensitiveData = false) => {
    const prompt = broadcastPrompt;
    setIsBroadcasting(true);
    setBroadcastError(null);
    setSensitiveFindings([]);
    setBroadcastResults([]);
    try {
      const result = await window.desktop.broadcastPrompt({
        accountIds: broadcastAccountIds,
        prompt,
        mode: broadcastMode,
        allowSensitiveData
      });
      setBroadcastResults(result.deliveries);
      setPromptHistory(await window.desktop.listPromptHistory());
    } catch (broadcastFailure) {
      setBroadcastError(
        broadcastFailure instanceof Error
          ? broadcastFailure.message
          : "The prompt could not be broadcast."
      );
    } finally {
      setIsBroadcasting(false);
    }
  };

  const saveSchedule = async (allowSensitiveData = false) => {
    const firstRun = new Date(scheduleAt);
    if (!scheduleAt || !Number.isFinite(firstRun.getTime()) || firstRun.getTime() <= Date.now()) {
      setBroadcastError("Choose a future date and time for the first run.");
      return;
    }
    setIsBroadcasting(true);
    setBroadcastError(null);
    setSensitiveFindings([]);
    try {
      const schedule = await window.desktop.createSchedule({
        accountIds: broadcastAccountIds,
        prompt: broadcastPrompt,
        mode: broadcastMode,
        recurrence: scheduleRecurrence,
        firstRunAt: firstRun.toISOString(),
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        localStartAt: scheduleAt,
        allowSensitiveData
      });
      setSchedules((current) => [...current.filter((item) => item.id !== schedule.id), schedule]);
      setIsBroadcastOpen(false);
      void window.desktop.releaseBroadcastViews();
      openSettings("automation");
      setSettingsMessage(`Scheduled for ${formatDateTime(schedule.nextRunAt)}.`);
    } catch (scheduleError) {
      setBroadcastError(
        scheduleError instanceof Error
          ? scheduleError.message
          : "The schedule could not be saved."
      );
    } finally {
      setIsBroadcasting(false);
    }
  };

  const performBroadcastAction = (allowSensitiveData = false) => {
    if (broadcastTiming === "scheduled") {
      void saveSchedule(allowSensitiveData);
    } else {
      void sendBroadcast(allowSensitiveData);
    }
  };

  const submitBroadcast = (event: React.FormEvent) => {
    event.preventDefault();
    const prompt = broadcastPrompt;
    if (!prompt.trim() || broadcastAccountIds.length < 1) {
      setBroadcastError("Choose at least one connected account and enter a prompt.");
      return;
    }
    const protectedContents = accounts
      .filter(
        (account) =>
          broadcastAccountIds.includes(account.id) &&
          preferences.dataProtectionByService[account.serviceId]
      )
      .map((account) => {
        const settings = accountSettings.find((item) => item.accountId === account.id);
        return settings?.includeContextInPrompts && settings.contextNote.trim()
          ? `${settings.contextNote}\n${prompt}`
          : prompt;
      });
    const findings =
      protectedContents.length > 0 ? scanSensitiveData(protectedContents.join("\n")) : [];
    if (findings.length > 0) {
      setBroadcastError(null);
      setSensitiveFindings(findings);
      return;
    }
    performBroadcastAction();
  };

  const updateSelectedAccountSettings = (
    update: Partial<AccountProviderSettings>
  ) => {
    if (!settingsAccountId) {
      return;
    }
    setAccountSettings((current) => {
      const existing =
        current.find((settings) => settings.accountId === settingsAccountId) ??
        defaultAccountSettings(settingsAccountId);
      return [
        ...current.filter((settings) => settings.accountId !== settingsAccountId),
        { ...existing, ...update }
      ];
    });
    setSettingsMessage(null);
  };

  const saveSelectedAccountSettings = async () => {
    if (!selectedAccountSettings) {
      return;
    }
    setSettingsError(null);
    setSettingsMessage(null);
    try {
      const saved = await window.desktop.updateAccountSettings(settingsAccountId, {
        defaultBroadcastMode: selectedAccountSettings.defaultBroadcastMode,
        contextNote: selectedAccountSettings.contextNote,
        includeContextInPrompts: selectedAccountSettings.includeContextInPrompts,
        zoomPercent: selectedAccountSettings.zoomPercent
      });
      setAccountSettings((current) => [
        ...current.filter((settings) => settings.accountId !== saved.accountId),
        saved
      ]);
      setSettingsMessage("Account settings saved locally.");
    } catch (saveError) {
      setSettingsError(
        saveError instanceof Error ? saveError.message : "Unable to save account settings."
      );
    }
  };

  const reuseHistoryEntry = (entry: PromptHistoryEntry) => {
    const existingIds = entry.accountIds.filter((id) =>
      accounts.some((account) => account.id === id)
    );
    setBroadcastPrompt(entry.prompt);
    setBroadcastMode(entry.mode);
    setBroadcastAccountIds(
      (existingIds.length > 0 ? existingIds : sortAccounts(accounts).map((a) => a.id))
        .slice(0, MAX_BROADCAST_TARGETS)
    );
    setBroadcastTiming("now");
    setIsSettingsOpen(false);
    setIsBroadcastOpen(true);
  };

  const selectBroadcastTemplate = (templateId: string) => {
    setBroadcastTemplateId(templateId);
    setBroadcastTemplateValues(emptyTemplateValues());
    setBroadcastTemplateError(null);
  };

  const applyBroadcastTemplate = () => {
    if (!selectedBroadcastTemplate) {
      setBroadcastTemplateError("Choose a prompt template first.");
      return;
    }
    if (missingBroadcastTemplateVariables.length > 0) {
      setBroadcastTemplateError(
        `Enter a value for ${missingBroadcastTemplateVariables.join(", ")} before applying.`
      );
      return;
    }
    if (renderedTemplatePreview.length > 12_000) {
      setBroadcastTemplateError(
        "The rendered prompt exceeds 12,000 characters. Shorten one or more variable values."
      );
      return;
    }
    setBroadcastPrompt(renderedTemplatePreview);
    setBroadcastTemplateError(null);
    setSensitiveFindings([]);
    requestAnimationFrame(() => broadcastPromptRef.current?.focus());
  };

  const usePromptTemplate = (template: PromptTemplate) => {
    openBroadcast();
    setBroadcastTemplateId(template.id);
    setBroadcastTemplateValues(emptyTemplateValues());
    setBroadcastTemplateError(null);
    setIsSettingsOpen(false);
  };

  const startCreatingTemplate = () => {
    setEditingTemplateId(null);
    setTemplateDraft(emptyTemplateInput());
    setTemplateFormMode("create");
    setSettingsError(null);
    setSettingsMessage(null);
  };

  const startEditingTemplate = (template: PromptTemplate) => {
    setEditingTemplateId(template.id);
    setTemplateDraft({
      name: template.name,
      category: template.category ?? "",
      description: template.description ?? "",
      content: template.content
    });
    setTemplateFormMode("edit");
    setSettingsError(null);
    setSettingsMessage(null);
  };

  const cancelTemplateForm = () => {
    setTemplateFormMode(null);
    setEditingTemplateId(null);
    setTemplateDraft(emptyTemplateInput());
  };

  const savePromptTemplate = async () => {
    setIsSavingTemplate(true);
    setSettingsError(null);
    setSettingsMessage(null);
    try {
      const saved =
        templateFormMode === "edit" && editingTemplateId
          ? await window.desktop.updatePromptTemplate(editingTemplateId, templateDraft)
          : await window.desktop.createPromptTemplate(templateDraft);
      setPromptTemplates((current) => [
        ...current.filter((template) => template.id !== saved.id),
        saved
      ]);
      cancelTemplateForm();
      setSettingsMessage(
        templateFormMode === "edit"
          ? "Prompt template updated locally."
          : "Prompt template saved locally."
      );
    } catch (saveError) {
      setSettingsError(
        saveError instanceof Error ? saveError.message : "Unable to save prompt template."
      );
    } finally {
      setIsSavingTemplate(false);
    }
  };

  const deletePromptTemplate = async (template: PromptTemplate) => {
    setSettingsError(null);
    setSettingsMessage(null);
    try {
      const deleted = await window.desktop.deletePromptTemplate(template.id);
      if (!deleted) {
        return;
      }
      setPromptTemplates((current) =>
        current.filter((item) => item.id !== template.id)
      );
      if (editingTemplateId === template.id) {
        cancelTemplateForm();
      }
      if (broadcastTemplateId === template.id) {
        setBroadcastTemplateId("");
        setBroadcastTemplateValues(emptyTemplateValues());
      }
      setSettingsMessage("Prompt template deleted.");
    } catch (deleteError) {
      setSettingsError(
        deleteError instanceof Error
          ? deleteError.message
          : "Unable to delete prompt template."
      );
    }
  };

  const settingsCopy: Record<SettingsPage, { kicker: string; description: string }> = {
    preferences: {
      kicker: "Preferences",
      description: "Customize appearance and accessibility."
    },
    accounts: {
      kicker: "Per-account controls",
      description: "Set provider defaults, reusable context, and page zoom."
    },
    templates: {
      kicker: "Prompt library",
      description: "Create reusable prompts with variables and use them in Broadcast."
    },
    memory: {
      kicker: "Local prompt memory",
      description: "Reuse prompts sent through Broadcast and Automation."
    },
    automation: {
      kicker: "Scheduled prompts",
      description: "Manage prompts that run while AI Workspace is open."
    },
    shortcuts: {
      kicker: "Keyboard",
      description: "Navigate directly to each provider without duplicating shortcuts."
    },
    "data-protection": {
      kicker: "Privacy controls",
      description: "Warn before sensitive data leaves this device."
    },
    usage: {
      kicker: "Insights",
      description: "Understand which AI services you use most."
    }
  };

  return (
    <div className={`app-shell ${isSidebarCollapsed ? "is-sidebar-collapsed" : ""}`}>
      <aside className="sidebar">
        <header className="brand">
          <div className="brand-mark" aria-hidden="true">A</div>
          <div className="brand-copy">
            <strong>AI Workspace</strong>
            <span>Your AI apps in one place</span>
          </div>
          <button
            aria-label={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="sidebar-toggle"
            onClick={() => setIsSidebarCollapsed((collapsed) => !collapsed)}
            title={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            type="button"
          >
            <Icon name={isSidebarCollapsed ? "arrow-right" : "arrow-left"} size={17} />
          </button>
        </header>

        <div className="sidebar-primary-action">
          <button className="connect-button" onClick={() => openConnectDialog()} type="button">
            <Icon name="plus" />
            <span className="sidebar-action-copy">
              <strong>Add AI account</strong>
              <small>Connect a subscription</small>
            </span>
            <kbd>Ctrl N</kbd>
          </button>
          <button
            className="broadcast-button"
            disabled={accounts.length === 0}
            onClick={openBroadcast}
            ref={broadcastButtonRef}
            title="Broadcast a prompt"
            type="button"
          >
            <Icon name="send" />
            <span>Broadcast a prompt</span>
            <small>{accounts.length > 0 ? `${accounts.length} ready` : "Connect first"}</small>
          </button>
          <button
            className="research-button"
            disabled={accounts.length === 0}
            onClick={() => setIsResearchOpen(true)}
            ref={researchButtonRef}
            title="Open Research Lab"
            type="button"
          >
            <Icon name="sparkles" />
            <span>Open Research Lab</span>
            <small>Compare & improve</small>
          </button>
          <button
            className="use-cases-button"
            onClick={() => setIsUseCasesOpen(true)}
            ref={useCasesButtonRef}
            title="Open Use Cases"
            type="button"
          >
            <Icon name="grid" />
            <span>Use Cases</span>
            <small>GEO available</small>
          </button>
        </div>

        <div className="accounts-drawer">
          <button
            aria-expanded={isAccountListOpen}
            className="accounts-drawer-toggle"
            onClick={() => setIsAccountListOpen((open) => !open)}
            title="Connected accounts"
            type="button"
          >
            <Icon name="users" size={17} />
            <span>Connected accounts</span>
            <span className="accounts-count">{accounts.length}</span>
            <Icon name={isAccountListOpen ? "chevron-down" : "chevron-right"} size={15} />
          </button>
        </div>

        {isAccountListOpen && isSidebarCollapsed ? (
          <nav className="collapsed-account-list" aria-label="Connected AI accounts">
            {sortAccounts(accounts).map((account) => (
              <button
                aria-current={selectedAccountId === account.id ? "page" : undefined}
                className={selectedAccountId === account.id ? "is-active" : ""}
                key={account.id}
                onClick={() => void selectAccount(account.id)}
                title={`${account.label} · ${SERVICE_BY_ID.get(account.serviceId)?.name ?? account.serviceId}`}
                type="button"
              >
                <ServiceLogo serviceId={account.serviceId} size="small" />
              </button>
            ))}
            {accounts.length === 0 ? (
              <button
                aria-label="Add AI account"
                className="collapsed-account-add"
                onClick={() => openConnectDialog()}
                title="Add AI account"
                type="button"
              >
                <Icon name="plus" size={17} />
              </button>
            ) : null}
          </nav>
        ) : isAccountListOpen ? (
          <nav className="service-list" aria-label="AI accounts">
          {SERVICES.filter((service) =>
            accounts.some((account) => account.serviceId === service.id)
          ).map((service) => {
            const serviceAccounts = sortAccounts(
              accounts.filter((account) => account.serviceId === service.id)
            );
            const shortcut = SERVICE_NUMBER.get(service.id);
            return (
              <section className="service-group" key={service.id}>
                <div className="service-heading">
                  <ServiceLogo serviceId={service.id} size="small" />
                  <strong>{service.name}</strong>
                  {shortcut ? <kbd>Ctrl {shortcut}</kbd> : null}
                </div>

                {serviceAccounts.length > 0 ? (
                  <div className="account-list">
                    {serviceAccounts.map((account) => (
                      <div
                        className={`account-row ${
                          selectedAccountId === account.id ? "is-active" : ""
                        }`}
                        key={account.id}
                      >
                        <button
                          className="account-select"
                          onClick={() => void selectAccount(account.id)}
                          type="button"
                        >
                          <span className="account-presence" />
                          <span className="account-copy">
                            <strong>{account.label}</strong>
                            <small>
                              {selectedAccountId === account.id ? "Active" : "Ready"}
                            </small>
                          </span>
                        </button>
                        <button
                          aria-label={`Remove ${account.label}`}
                          className="remove-account"
                          onClick={(event) => void removeAccount(event, account.id)}
                          title="Remove local account"
                          type="button"
                        >
                          <Icon name="trash" size={15} />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : null}
              </section>
            );
          })}
          {accounts.length === 0 ? (
            <div className="accounts-empty">
              <span>No accounts connected yet.</span>
              <button onClick={() => openConnectDialog()} type="button">Add account</button>
            </div>
          ) : null}
          </nav>
        ) : (
          <div className="sidebar-spacer" />
        )}

        <footer className="sidebar-footer">
          <div className="security-card">
            <Icon name="shield" size={17} />
            <div>
              <strong>Private sessions</strong>
              <span>Passwords and data stay on official websites.</span>
            </div>
          </div>
          <button
            className="settings-button"
            onClick={() => openSettings("usage")}
            type="button"
          >
            <Icon name="chart" size={17} />
            <span>Usage</span>
            <span className="settings-badge">Local</span>
          </button>
          <button
            className="settings-button"
            onClick={() => openSettings()}
            ref={settingsButtonRef}
            type="button"
          >
            <Icon name="settings" size={17} />
            <span>Settings</span>
            <kbd>Ctrl ,</kbd>
          </button>
        </footer>
      </aside>

      <main className="main-panel">
        <header className="browser-toolbar">
          <div className="browser-actions">
            <button
              aria-label="Back"
              className="icon-button"
              disabled={!viewState?.canGoBack}
              onClick={() => void runBrowserAction(window.desktop.goBack)}
              title="Back"
              type="button"
            >
              <Icon name="arrow-left" />
            </button>
            <button
              aria-label="Forward"
              className="icon-button"
              disabled={!viewState?.canGoForward}
              onClick={() => void runBrowserAction(window.desktop.goForward)}
              title="Forward"
              type="button"
            >
              <Icon name="arrow-right" />
            </button>
            <button
              aria-label="Reload"
              className={`icon-button ${viewState?.isLoading ? "is-spinning" : ""}`}
              disabled={!selectedAccount}
              onClick={() => void runBrowserAction(window.desktop.reload)}
              title="Reload"
              type="button"
            >
              <Icon name="refresh" />
            </button>
          </div>

          <div className="current-context">
            {selectedAccount ? (
              <>
                <ServiceLogo serviceId={selectedAccount.serviceId} size="small" />
                <div>
                  <strong>{selectedAccount.label}</strong>
                  <span>
                    {viewState?.error
                      ? "Page unavailable"
                      : `${SERVICE_BY_ID.get(selectedAccount.serviceId)?.name} · ${formatHost(
                          viewState?.url ?? ""
                        )}`}
                  </span>
                </div>
                <span
                  className={`connection-status ${
                    viewState?.error
                      ? "has-error"
                      : viewState?.isLoading
                        ? "is-loading"
                        : ""
                  }`}
                />
              </>
            ) : (
              <div className="workspace-label">
                <strong>Start here</strong>
                <span>Connect your first AI account</span>
              </div>
            )}
          </div>

          <div className="toolbar-account">
            {selectedAccount ? (
              <button
                className="secondary-button"
                onClick={() => void runBrowserAction(window.desktop.openCurrentInBrowser)}
                title="Open in your default browser"
                type="button"
              >
                <Icon name="external" size={16} />
                Open in browser
              </button>
            ) : null}
          </div>
        </header>

        {showPerplexityAuthGuidance ? (
          <aside className="provider-auth-guidance" aria-label="Perplexity sign-in guidance">
            <div>
              <strong>Do you normally use “Continue with Google”?</strong>
              <span>
                You can try it here. If Google rejects the embedded window, use Perplexity’s
                email sign-in with the same Gmail address instead.
              </span>
            </div>
            <button onClick={dismissAuthGuidance} type="button">Got it</button>
          </aside>
        ) : null}

        {error ? (
          <div className="error-banner" role="alert">
            <span>{error}</span>
            <button onClick={() => setError(null)} type="button">Dismiss</button>
          </div>
        ) : null}

        <div className="workspace" ref={workspaceRef}>
          {!selectedAccount ? (
            <section className="onboarding">
              <div className="onboarding-copy">
                <span className="eyebrow">
                  {isBooting ? "Getting things ready" : "Set up your workspace"}
                </span>
                <h1>Move between AI apps.<br />Never lose your flow.</h1>
                <p>
                  Sign in to your official accounts and keep them ready in one
                  desktop app.
                </p>
              </div>

              <div className="setup-steps" aria-label="How it works">
                <div className="setup-step is-current">
                  <span>1</span>
                  <div><strong>Choose a service</strong><small>Eight supported AI services</small></div>
                </div>
                <div className="step-line" />
                <div className="setup-step">
                  <span>2</span>
                  <div><strong>Sign in on the official website</strong><small>We never store your password</small></div>
                </div>
                <div className="step-line" />
                <div className="setup-step">
                  <span>3</span>
                  <div><strong>Switch between accounts</strong><small>One click from the sidebar</small></div>
                </div>
              </div>

              <div className="service-picker">
                <div className="picker-heading">
                  <div>
                    <strong>Choose your first AI service</strong>
                    <span>You can add more at any time.</span>
                  </div>
                  <span>Step 1 of 3</span>
                </div>
                <div className="service-cards">
                  {SERVICES.map((service) => (
                    <button
                      key={service.id}
                      onClick={() => openConnectDialog(service.id)}
                      type="button"
                    >
                      <ServiceLogo serviceId={service.id} size="large" />
                      <span>
                        <strong>{service.name}</strong>
                        <small>Connect account</small>
                      </span>
                      <Icon name="chevron-right" size={17} />
                    </button>
                  ))}
                </div>
                <div className="privacy-row">
                  <Icon name="lock" size={15} />
                  Sessions are isolated by account and stored only on this device.
                </div>
              </div>
            </section>
          ) : (
            <div className="loading-surface">
              <ServiceLogo serviceId={selectedAccount.serviceId} size="large" />
              <div>
                <strong>Opening {selectedAccount.label}</strong>
                <span>Connecting to the official website...</span>
              </div>
            </div>
          )}
        </div>
      </main>

      {isConnectDialogOpen && connectServiceId ? (
        <div className="modal-backdrop" role="presentation" onMouseDown={closeConnectDialog}>
          <section
            aria-labelledby="connect-title"
            aria-modal="true"
            className="connect-dialog"
            onKeyDown={trapDialogFocus}
            onMouseDown={(event) => event.stopPropagation()}
            role="dialog"
          >
            <header className="dialog-header">
              <div>
                <span className="dialog-kicker">New account</span>
                <h2 id="connect-title">Connect an AI app</h2>
                <p>Choose a service and give this session a recognizable name.</p>
              </div>
              <button
                aria-label="Close"
                className="icon-button"
                disabled={isConnecting}
                onClick={closeConnectDialog}
                type="button"
              >
                <Icon name="x" />
              </button>
            </header>

            <form onSubmit={(event) => void addAccount(event)}>
              <fieldset className="service-options">
                <legend>1. Choose a service</legend>
                <div>
                  {SERVICES.map((service) => (
                    <label
                      className={connectServiceId === service.id ? "is-selected" : ""}
                      key={service.id}
                    >
                      <input
                        checked={connectServiceId === service.id}
                        name="service"
                        onChange={() => setConnectServiceId(service.id)}
                        type="radio"
                        value={service.id}
                      />
                      <ServiceLogo serviceId={service.id} size="medium" />
                      <span>{service.name}</span>
                      <span className="option-check"><Icon name="check" size={14} /></span>
                    </label>

                  ))}
                </div>
              </fieldset>

              <label className="label-field">
                <span>2. Name this account</span>
                <input
                  maxLength={40}
                  onChange={(event) => setAccountLabel(event.target.value)}
                  placeholder="For example: Personal, Work, Client..."
                  ref={inputRef}
                  value={accountLabel}
                />
                <small>This name helps you recognize it in the sidebar.</small>
              </label>

              <div className="dialog-security">
                <Icon name="shield" size={20} />
                <div>
                  <strong>Secure sign-in on the official website</strong>
                  <span>
                    After you continue, you’ll enter your credentials directly on{" "}
                    {SERVICE_BY_ID.get(connectServiceId)?.name}. AI Workspace cannot
                    read your password.
                  </span>
                </div>
              </div>

              <footer className="dialog-actions">
                <button
                  className="dialog-cancel"
                  disabled={isConnecting}
                  onClick={closeConnectDialog}
                  type="button"
                >
                  Cancel
                </button>
                <button
                  className="dialog-confirm"
                  disabled={!accountLabel.trim() || isConnecting}
                  type="submit"
                >
                  {isConnecting
                    ? "Preparing..."
                    : `Continue to ${SERVICE_BY_ID.get(connectServiceId)?.name}`}
                  <Icon name="arrow-right" size={17} />
                </button>
              </footer>
            </form>
          </section>
        </div>
      ) : null}

      {isSettingsOpen ? (
        <div className="modal-backdrop" role="presentation" onMouseDown={closeSettings}>
          <section
            aria-labelledby="settings-title"
            aria-modal="true"
            className="settings-dialog"
            onKeyDown={trapDialogFocus}
            onMouseDown={(event) => event.stopPropagation()}
            role="dialog"
          >
            <header className="settings-header">
              <div>
                <span className="dialog-kicker">
                  {settingsCopy[settingsPage].kicker}
                </span>
                <h2 id="settings-title">Settings</h2>
                <p>{settingsCopy[settingsPage].description}</p>
              </div>
              <button
                aria-label="Close settings"
                className="icon-button"
                onClick={closeSettings}
                ref={settingsCloseRef}
                type="button"
              >
                <Icon name="x" />
              </button>
            </header>

            <nav className="settings-tabs" aria-label="Settings sections">
              {SETTINGS_TABS.map((tab) => (
                <button
                  aria-current={settingsPage === tab.page ? "page" : undefined}
                  className={settingsPage === tab.page ? "is-active" : ""}
                  key={tab.page}
                  onClick={() => {
                    setSettingsPage(tab.page);
                    setSettingsError(null);
                    setSettingsMessage(null);
                  }}
                  type="button"
                >
                  <Icon name={tab.icon} size={15} />
                  {tab.label}
                </button>
              ))}
            </nav>

            <div className="settings-content">
              {settingsError ? (
                <div className="usage-error" role="alert">{settingsError}</div>
              ) : null}
              {settingsMessage ? (
                <div className="settings-message" role="status">{settingsMessage}</div>
              ) : null}
              {settingsPage === "preferences" ? (
                <>
              <section className="settings-section" aria-labelledby="appearance-heading">
                <div className="settings-section-heading">
                  <span className="settings-section-icon"><Icon name="moon" size={18} /></span>
                  <div>
                    <h3 id="appearance-heading">Appearance</h3>
                    <p>Choose the background for the AI Workspace interface.</p>
                  </div>
                </div>
                <fieldset className="theme-options">
                  <legend className="sr-only">Interface theme</legend>
                  {([
                    ["light", "Light", "Bright background"],
                    ["dark", "Dark", "Black background"],
                    ["system", "System", "Match your device"]
                  ] as const).map(([value, label, description]) => (
                    <label className={preferences.theme === value ? "is-selected" : ""} key={value}>
                      <input
                        checked={preferences.theme === value}
                        name="theme"
                        onChange={() => setPreferences((current) => ({ ...current, theme: value }))}
                        type="radio"
                        value={value}
                      />
                      <span className={`theme-preview theme-preview-${value}`}>
                        <span />
                        <span />
                      </span>
                      <strong>{label}</strong>
                      <small>{description}</small>
                      <span className="theme-check"><Icon name="check" size={13} /></span>
                    </label>
                  ))}
                </fieldset>
              </section>

              <section className="settings-section" aria-labelledby="accessibility-heading">
                <div className="settings-section-heading">
                  <span className="settings-section-icon"><Icon name="eye" size={18} /></span>
                  <div>
                    <h3 id="accessibility-heading">Accessibility</h3>
                    <p>Adjust readability, contrast, and motion.</p>
                  </div>
                </div>

                <div className="preference-row text-size-row">
                  <div>
                    <span className="preference-label"><Icon name="type" size={16} /> Text size</span>
                    <small>Enlarges labels and app controls.</small>
                  </div>

                  <div className="preference-row">
                    <div>
                      <span className="preference-label">Interface zoom</span>
                      <small>
                        Reflows the whole app. Use Ctrl/Cmd +, Ctrl/Cmd −, or Ctrl/Cmd 0.
                      </small>
                    </div>
                    <strong className="zoom-value">{preferences.appZoomPercent}%</strong>
                  </div>
                  <div className="segmented-control" aria-label="Text size">
                    {([
                      ["standard", "A"],
                      ["large", "A+"],
                      ["extra-large", "A++"]
                    ] as const).map(([value, label]) => (
                      <button
                        aria-pressed={preferences.textSize === value}
                        className={preferences.textSize === value ? "is-active" : ""}
                        key={value}
                        onClick={() =>
                          setPreferences((current) => ({ ...current, textSize: value }))
                        }
                        type="button"
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="preference-row">
                  <div>
                    <span className="preference-label">High contrast</span>
                    <small>Makes borders, text, and indicators more prominent.</small>
                  </div>
                  <button
                    aria-checked={preferences.highContrast}
                    aria-label="High contrast"
                    className="switch"
                    onClick={() =>
                      setPreferences((current) => ({
                        ...current,
                        highContrast: !current.highContrast
                      }))
                    }
                    role="switch"
                    type="button"
                  >
                    <span />
                  </button>
                </div>

                <div className="preference-row">
                  <div>
                    <span className="preference-label">Reduce motion</span>
                    <small>Disables non-essential animations and transitions.</small>
                  </div>
                  <button
                    aria-checked={preferences.reducedMotion}
                    aria-label="Reduce motion"
                    className="switch"
                    onClick={() =>
                      setPreferences((current) => ({
                        ...current,
                        reducedMotion: !current.reducedMotion
                      }))
                    }
                    role="switch"
                    type="button"
                  >
                    <span />
                  </button>
                </div>
              </section>

              <section className="settings-security-summary">
                <Icon name="shield" size={19} />
                <div>
                  <strong>Session security</strong>
                  <span>
                    Each account uses an isolated browser session. Passwords are
                    entered only on official websites.
                  </span>
                </div>
              </section>
                </>
              ) : settingsPage === "accounts" ? (
                <section className="account-settings-panel" aria-labelledby="account-settings-heading">
                  <div className="settings-section-heading">
                    <span className="settings-section-icon"><Icon name="sparkles" size={18} /></span>
                    <div>
                      <h3 id="account-settings-heading">Provider settings per account</h3>
                      <p>These settings are stored locally and apply only to the selected account.</p>
                    </div>
                  </div>
                  {accounts.length === 0 || !selectedAccountSettings ? (
                    <p className="empty-settings">Connect an account to configure provider settings.</p>
                  ) : (
                    <>
                      <label className="settings-field">
                        <span>Account</span>
                        <select
                          onChange={(event) => setSettingsAccountId(event.target.value)}
                          value={settingsAccountId}
                        >
                          {sortAccounts(accounts).map((account) => (
                            <option key={account.id} value={account.id}>
                              {account.label} · {SERVICE_BY_ID.get(account.serviceId)?.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <div className="account-settings-grid">
                        <label className="settings-field">
                          <span>Default Broadcast mode</span>
                          <select
                            onChange={(event) =>
                              updateSelectedAccountSettings({
                                defaultBroadcastMode: event.target.value as BroadcastMode
                              })
                            }
                            value={selectedAccountSettings.defaultBroadcastMode}
                          >
                            <option value="standard">Standard prompt</option>
                            <option value="deep-research">Deep Research</option>
                          </select>
                        </label>
                        <label className="settings-field">
                          <span>Provider page zoom</span>
                          <select
                            onChange={(event) =>
                              updateSelectedAccountSettings({
                                zoomPercent: Number(event.target.value)
                              })
                            }
                            value={selectedAccountSettings.zoomPercent}
                          >
                            {[75, 90, 100, 110, 125, 150, 175, 200].map((zoom) => (
                              <option key={zoom} value={zoom}>{zoom}%</option>
                            ))}
                          </select>
                        </label>
                      </div>
                      <label className="settings-field context-field">
                        <span>Saved context</span>
                        <textarea
                          maxLength={4_000}
                          onChange={(event) =>
                            updateSelectedAccountSettings({ contextNote: event.target.value })
                          }
                          placeholder="Optional project background or instructions to prepend to Broadcast and scheduled prompts..."
                          rows={6}
                          value={selectedAccountSettings.contextNote}
                        />
                        <small>{selectedAccountSettings.contextNote.length} / 4,000</small>
                      </label>
                      <div className="preference-row">
                        <div>
                          <span className="preference-label">Include saved context</span>
                          <small>
                            Clearly prepends this note to prompts sent through Broadcast and Automation.
                            It never reads provider responses.
                          </small>
                        </div>
                        <button
                          aria-checked={selectedAccountSettings.includeContextInPrompts}
                          aria-label={`Include saved context for ${selectedSettingsAccount?.label ?? "account"}`}
                          className="switch"
                          onClick={() =>
                            updateSelectedAccountSettings({
                              includeContextInPrompts:
                                !selectedAccountSettings.includeContextInPrompts
                            })
                          }
                          role="switch"
                          type="button"
                        >
                          <span />
                        </button>
                      </div>
                      <button
                        className="inline-primary-button"
                        onClick={() => void saveSelectedAccountSettings()}
                        type="button"
                      >
                        Save account settings
                      </button>
                    </>
                  )}
                </section>
              ) : settingsPage === "templates" ? (
                <section className="template-panel" aria-labelledby="template-heading">
                  <div className="settings-section-heading">
                    <span className="settings-section-icon"><Icon name="type" size={18} /></span>
                    <div>
                      <h3 id="template-heading">Prompt templates</h3>
                      <p>
                        Add variables such as {"{{topic}}"} and fill them in before applying a
                        template.
                      </p>
                    </div>
                  </div>

                  <div className="template-toolbar">
                    <label>
                      <span className="sr-only">Search prompt templates</span>
                      <input
                        aria-label="Search prompt templates"
                        onChange={(event) => setTemplateSearch(event.target.value)}
                        placeholder="Search templates, categories, or content"
                        type="search"
                        value={templateSearch}
                      />
                    </label>
                    <button
                      className="inline-primary-button"
                      onClick={startCreatingTemplate}
                      type="button"
                    >
                      <Icon name="plus" size={15} /> New template
                    </button>
                  </div>

                  {templateFormMode ? (
                    <div className="template-editor" aria-label={`${templateFormMode === "edit" ? "Edit" : "Create"} prompt template`}>
                      <div className="template-editor-grid">
                        <label className="settings-field">
                          <span>Name</span>
                          <input
                            maxLength={80}
                            onChange={(event) =>
                              setTemplateDraft((current) => ({
                                ...current,
                                name: event.target.value
                              }))
                            }
                            ref={templateNameRef}
                            required
                            value={templateDraft.name}
                          />
                        </label>
                        <label className="settings-field">
                          <span>Category (optional)</span>
                          <input
                            maxLength={80}
                            onChange={(event) =>
                              setTemplateDraft((current) => ({
                                ...current,
                                category: event.target.value
                              }))
                            }
                            value={templateDraft.category ?? ""}
                          />
                        </label>
                      </div>
                      <label className="settings-field">
                        <span>Description (optional)</span>
                        <input
                          maxLength={500}
                          onChange={(event) =>
                            setTemplateDraft((current) => ({
                              ...current,
                              description: event.target.value
                            }))
                          }
                          value={templateDraft.description ?? ""}
                        />
                      </label>
                      <label className="settings-field context-field">
                        <span>Prompt content</span>
                        <textarea
                          maxLength={12_000}
                          onChange={(event) =>
                            setTemplateDraft((current) => ({
                              ...current,
                              content: event.target.value
                            }))
                          }
                          placeholder="Write a prompt. Use {{variableName}} for values to fill in later."
                          required
                          rows={7}
                          value={templateDraft.content}
                        />
                        <small>
                          {templateDraft.content.length.toLocaleString()} / 12,000
                          {extractTemplateVariables(templateDraft.content).length > 0
                            ? ` · Variables: ${extractTemplateVariables(templateDraft.content).join(", ")}`
                            : ""}
                        </small>
                      </label>
                      <div className="template-editor-actions">
                        <button
                          className="reset-button"
                          disabled={isSavingTemplate}
                          onClick={cancelTemplateForm}
                          type="button"
                        >
                          Cancel
                        </button>
                        <button
                          className="inline-primary-button"
                          disabled={
                            isSavingTemplate ||
                            !templateDraft.name.trim() ||
                            !templateDraft.content.trim()
                          }
                          onClick={() => void savePromptTemplate()}
                          type="button"
                        >
                          {isSavingTemplate
                            ? "Saving..."
                            : templateFormMode === "edit"
                              ? "Update template"
                              : "Save template"}
                        </button>
                      </div>
                    </div>
                  ) : null}

                  {promptTemplates.length === 0 ? (
                    <p className="empty-settings">
                      No prompt templates yet. Create one to reuse it across any connected account.
                    </p>
                  ) : filteredPromptTemplates.length === 0 ? (
                    <p className="empty-settings">No templates match your search.</p>
                  ) : (
                    <div className="template-list">
                      {[...filteredPromptTemplates]
                        .sort((left, right) => left.name.localeCompare(right.name))
                        .map((template) => {
                          const variables = extractTemplateVariables(template.content);
                          return (
                            <article key={template.id}>
                              <header>
                                <div>
                                  <strong>{template.name}</strong>
                                  {template.category ? <span>{template.category}</span> : null}
                                </div>
                                <time dateTime={template.updatedAt}>
                                  Updated {formatDateTime(template.updatedAt)}
                                </time>
                              </header>
                              {template.description ? <p>{template.description}</p> : null}
                              <pre>{template.content}</pre>
                              {variables.length > 0 ? (
                                <small>Variables: {variables.join(", ")}</small>
                              ) : null}
                              <footer>
                                <button
                                  disabled={accounts.length === 0}
                                  onClick={() => usePromptTemplate(template)}
                                  title={
                                    accounts.length === 0
                                      ? "Connect an account before using a template"
                                      : undefined
                                  }
                                  type="button"
                                >
                                  Use in Broadcast
                                </button>
                                <button onClick={() => startEditingTemplate(template)} type="button">
                                  Edit
                                </button>
                                <button
                                  className="danger-link"
                                  onClick={() => void deletePromptTemplate(template)}
                                  type="button"
                                >
                                  Delete
                                </button>
                              </footer>
                            </article>
                          );
                        })}
                    </div>
                  )}
                </section>
              ) : settingsPage === "memory" ? (
                <section className="memory-panel" aria-labelledby="memory-heading">
                  <div className="settings-section-heading">
                    <span className="settings-section-icon"><Icon name="history" size={18} /></span>
                    <div>
                      <h3 id="memory-heading">Prompt history</h3>
                      <p>
                        Stores prompts submitted by this app—not provider replies—locally on this
                        device.
                      </p>
                    </div>
                  </div>
                  {promptHistory.length === 0 ? (
                    <p className="empty-settings">Broadcast or schedule a prompt to build reusable history.</p>
                  ) : (
                    <div className="memory-list">
                      {promptHistory.slice(0, 100).map((entry) => (
                        <article key={entry.id}>
                          <div>
                            <strong>{entry.source === "schedule" ? "Scheduled prompt" : "Broadcast prompt"}</strong>
                            <time dateTime={entry.createdAt}>{formatDateTime(entry.createdAt)}</time>
                          </div>
                          <p>{entry.prompt}</p>
                          <footer>
                            <span>{entry.accountIds.length} account{entry.accountIds.length === 1 ? "" : "s"} · {entry.mode}</span>
                            <button onClick={() => reuseHistoryEntry(entry)} type="button">Reuse</button>
                          </footer>
                        </article>
                      ))}
                    </div>
                  )}
                </section>
              ) : settingsPage === "automation" ? (
                <section className="automation-panel" aria-labelledby="automation-heading">
                  <div className="settings-section-heading">
                    <span className="settings-section-icon"><Icon name="clock" size={18} /></span>
                    <div>
                      <h3 id="automation-heading">Scheduled prompts</h3>
                      <p>
                        Runs due prompts only while AI Workspace is open. Delivery status is
                        recorded without reading responses.
                      </p>
                    </div>
                  </div>
                  <button
                    className="inline-primary-button"
                    disabled={accounts.length === 0}
                    onClick={() => {
                      setIsSettingsOpen(false);
                      openBroadcast();
                      setBroadcastTiming("scheduled");
                    }}
                    type="button"
                  >
                    <Icon name="plus" size={15} /> New schedule
                  </button>
                  {schedules.length === 0 ? (
                    <p className="empty-settings">No scheduled prompts yet.</p>
                  ) : (
                    <div className="schedule-list">
                      {[...schedules]
                        .sort((left, right) =>
                          (left.nextRunAt ?? "z").localeCompare(right.nextRunAt ?? "z")
                        )
                        .map((schedule) => (
                          <article key={schedule.id}>
                            <div className="schedule-heading">
                              <div>
                                <strong>{schedule.prompt}</strong>
                                <span>
                                  {schedule.recurrence} · {schedule.accountIds.length} account
                                  {schedule.accountIds.length === 1 ? "" : "s"}
                                </span>
                              </div>
                              <button
                                aria-checked={schedule.enabled}
                                aria-label={`${schedule.enabled ? "Pause" : "Enable"} schedule`}
                                className="switch"
                                disabled={schedule.nextRunAt === null}
                                onClick={() => {
                                  setSettingsError(null);
                                  void window.desktop
                                    .setScheduleEnabled(schedule.id, !schedule.enabled)
                                    .then((updated) =>
                                      setSchedules((current) =>
                                        current.map((item) =>
                                          item.id === updated.id ? updated : item
                                        )
                                      )
                                    )
                                    .catch((scheduleError: unknown) =>
                                      setSettingsError(
                                        scheduleError instanceof Error
                                          ? scheduleError.message
                                          : "Unable to update schedule."
                                      )
                                    );
                                }}
                                role="switch"
                                type="button"
                              >
                                <span />
                              </button>
                            </div>
                            <dl>
                              <div><dt>Next</dt><dd>{formatDateTime(schedule.nextRunAt)}</dd></div>
                              <div><dt>Last</dt><dd>{formatDateTime(schedule.lastRunAt)}</dd></div>
                              <div>
                                <dt>Outcome</dt>
                                <dd>{schedule.lastOutcome?.message ?? "Not run yet"}</dd>
                              </div>
                            </dl>
                            <button
                              className="danger-link"
                              onClick={() => {
                                setSettingsError(null);
                                void window.desktop
                                  .removeSchedule(schedule.id)
                                  .then(() =>
                                    setSchedules((current) =>
                                      current.filter((item) => item.id !== schedule.id)
                                    )
                                  )
                                  .catch((scheduleError: unknown) =>
                                    setSettingsError(
                                      scheduleError instanceof Error
                                        ? scheduleError.message
                                        : "Unable to remove schedule."
                                    )
                                  );
                              }}
                              type="button"
                            >
                              Remove
                            </button>
                          </article>
                        ))}
                    </div>
                  )}
                </section>
              ) : settingsPage === "shortcuts" ? (
                <section className="shortcut-panel" aria-labelledby="shortcut-heading">
                  <div className="settings-section-heading">
                    <span className="settings-section-icon"><Icon name="keyboard" size={18} /></span>
                    <div>
                      <h3 id="shortcut-heading">Provider navigation</h3>
                      <p>
                        Ctrl on Windows/Linux and Command on macOS. Each shortcut opens the most
                        recently used account for that provider.
                      </p>
                    </div>
                  </div>
                  <div className="shortcut-list">
                    {SERVICES.map((service, index) => (
                      <article key={service.id}>
                        <ServiceLogo serviceId={service.id} size="small" />
                        <strong>{service.name}</strong>
                        <kbd>Ctrl/⌘ + {index + 1}</kbd>
                      </article>
                    ))}
                    <article><Icon name="plus" size={17} /><strong>Connect account</strong><kbd>Ctrl/⌘ + N</kbd></article>
                    <article><Icon name="settings" size={17} /><strong>Settings</strong><kbd>Ctrl/⌘ + ,</kbd></article>
                    <article><Icon name="type" size={17} /><strong>Zoom in</strong><kbd>Ctrl/⌘ + +</kbd></article>
                    <article><Icon name="type" size={17} /><strong>Zoom out</strong><kbd>Ctrl/⌘ + −</kbd></article>
                    <article><Icon name="refresh" size={17} /><strong>Reset zoom</strong><kbd>Ctrl/⌘ + 0</kbd></article>
                  </div>
                </section>
              ) : settingsPage === "data-protection" ? (
                <section className="data-protection-settings" aria-labelledby="data-protection-heading">
                  <div className="data-protection-intro">
                    <span className="settings-section-icon"><Icon name="shield" size={18} /></span>
                    <div>
                      <h3 id="data-protection-heading">Sensitive data alerts</h3>
                      <p>
                        AI Workspace scans prompts locally before they are sent. Prompt contents
                        and findings are never stored or transmitted by this check.
                      </p>
                    </div>
                  </div>

                  <div className="protection-master-row">
                    <div>
                      <strong>Protect all AI tools</strong>
                      <span>
                        Recommended for personal or non-enterprise subscriptions.
                      </span>
                    </div>
                    <button
                      aria-checked={SERVICES.every(
                        (service) => preferences.dataProtectionByService[service.id]
                      )}
                      aria-label="Protect all AI tools"
                      className="switch"
                      onClick={() => {
                        const enableAll = !SERVICES.every(
                          (service) => preferences.dataProtectionByService[service.id]
                        );
                        setPreferences((current) => ({
                          ...current,
                          dataProtectionByService: {
                            chatgpt: enableAll,
                            claude: enableAll,
                            perplexity: enableAll,
                            gemini: enableAll,
                            zai: enableAll,
                            deepseek: enableAll,
                            kimi: enableAll,
                            mistral: enableAll
                          }
                        }));
                      }}
                      role="switch"
                      type="button"
                    >
                      <span />
                    </button>
                  </div>

                  <div className="protection-service-list">
                    {SERVICES.map((service) => {
                      const enabled = preferences.dataProtectionByService[service.id];
                      return (
                        <article key={service.id}>
                          <ServiceLogo serviceId={service.id} size="small" />
                          <div>
                            <strong>{service.name}</strong>
                            <span>{enabled ? "Alerts enabled" : "Alerts disabled"}</span>
                          </div>
                          <button
                            aria-checked={enabled}
                            aria-label={`Sensitive data alerts for ${service.name}`}
                            className="switch"
                            onClick={() =>
                              setPreferences((current) => ({
                                ...current,
                                dataProtectionByService: {
                                  ...current.dataProtectionByService,
                                  [service.id]: !current.dataProtectionByService[service.id]
                                }
                              }))
                            }
                            role="switch"
                            type="button"
                          >
                            <span />
                          </button>
                        </article>
                      );
                    })}
                  </div>

                  <div className="protection-detection-note">
                    <strong>What is detected</strong>
                    <span>
                      Email addresses, phone numbers, tax and identity numbers, payment details,
                      credentials, API keys, private keys, and common confidential-business
                      markings. Detection is advisory and may produce false positives or miss
                      context-specific information.
                    </span>
                  </div>
                </section>
              ) : (
                <section className="usage-dashboard" aria-labelledby="usage-heading">
                  <div className="usage-heading">
                    <div>
                      <h3 id="usage-heading">Your AI usage</h3>
                      <p>Focused time inside each service, measured locally on this device.</p>
                    </div>
                    <div className="segmented-control" aria-label="Usage period">
                      {([7, 30] as const).map((period) => (
                        <button
                          aria-pressed={usagePeriod === period}
                          className={usagePeriod === period ? "is-active" : ""}
                          key={period}
                          onClick={() => {
                            setUsagePeriod(period);
                            setSettingsMessage(null);
                          }}
                          type="button"
                        >
                          {period} days
                        </button>
                      ))}
                    </div>
                  </div>

                  {usageError ? (
                    <div className="usage-error" role="alert">{usageError}</div>
                  ) : null}

                  <div className="usage-summary-cards" aria-busy={isUsageLoading}>
                    <article>
                      <span>Active time</span>
                      <strong>{formatUsageDuration(usageSummary?.totalActiveMs ?? 0)}</strong>
                    </article>
                    <article>
                      <span>App opens</span>
                      <strong>{usageSummary?.totalOpens ?? 0}</strong>
                    </article>
                    <article>
                      <span>Most used</span>
                      <strong>
                        {usageSummary?.mostUsedServiceId
                          ? SERVICE_BY_ID.get(usageSummary.mostUsedServiceId)?.name
                          : "No data yet"}
                      </strong>
                    </article>
                  </div>

                  <div className="usage-service-list">
                    {SERVICES.map((service) => {
                      const usage = usageSummary?.services.find(
                        (candidate) => candidate.serviceId === service.id
                      );
                      const maximumActiveMs = Math.max(
                        1,
                        ...(usageSummary?.services.map((candidate) => candidate.activeMs) ?? [1])
                      );
                      const percentage = Math.round(
                        ((usage?.activeMs ?? 0) / maximumActiveMs) * 100
                      );
                      return (
                        <article className="usage-service-row" key={service.id}>
                          <ServiceLogo serviceId={service.id} size="small" />
                          <div className="usage-service-details">
                            <div>
                              <strong>{service.name}</strong>
                              <span>{usage?.opens ?? 0} opens</span>
                            </div>
                            <progress
                              aria-label={`${service.name} relative active time`}
                              className="usage-bar"
                              max={100}
                              value={percentage}
                            />
                          </div>
                          <strong className="usage-duration">
                            {formatUsageDuration(usage?.activeMs ?? 0)}
                          </strong>
                        </article>
                      );
                    })}
                  </div>

                  <div className="consumption-note">
                    <Icon name="eye" size={19} />
                    <div>
                      <strong>About tokens and cost</strong>
                      <span>
                        Official web apps do not expose reliable token, credit, or cost
                        data to this desktop app. Those figures require each provider’s
                        official API or billing integration, so AI Workspace does not
                        guess them.
                      </span>
                    </div>
                  </div>
                  <p className="usage-privacy">
                    Usage data never leaves this device. Time is counted only while the
                    app window is focused and the service is visible.
                  </p>
                </section>
              )}
            </div>

            <footer className="settings-footer">
              {settingsPage === "preferences" ? (
                <button
                  className="reset-button"
                  onClick={() => setPreferences(DEFAULT_PREFERENCES)}
                  type="button"
                >
                  Restore defaults
                </button>
              ) : settingsPage === "data-protection" ? (
                <button
                  className="reset-button"
                  onClick={() =>
                    setPreferences((current) => ({
                      ...current,
                      dataProtectionByService: { ...DEFAULT_DATA_PROTECTION_SETTINGS }
                    }))
                  }
                  type="button"
                >
                  Enable all alerts
                </button>
              ) : settingsPage === "memory" ? (
                <button
                  className="reset-button"
                  disabled={promptHistory.length === 0}
                  onClick={() => {
                    setSettingsError(null);
                    void window.desktop
                      .clearPromptHistory()
                      .then(() => {
                        setPromptHistory([]);
                        setSettingsMessage("Prompt history cleared.");
                      })
                      .catch((historyError: unknown) =>
                        setSettingsError(
                          historyError instanceof Error
                            ? historyError.message
                            : "Unable to clear prompt history."
                        )
                      );
                  }}
                  type="button"
                >
                  Clear prompt history
                </button>
              ) : settingsPage === "usage" ? (
                <div className="usage-footer-actions">
                  <button
                    className="reset-button"
                    disabled={isUsageLoading || isUsageExporting}
                    onClick={() => {
                      setIsUsageLoading(true);
                      setUsageError(null);
                      setSettingsMessage(null);
                      void window.desktop.resetUsage(usagePeriod)
                        .then((result) => {
                          setUsageSummary(result.summary);
                        })
                        .catch((resetError: unknown) => {
                          setUsageError(
                            resetError instanceof Error
                              ? resetError.message
                              : "Unable to reset usage data."
                          );
                        })
                        .finally(() => setIsUsageLoading(false));
                    }}
                    type="button"
                  >
                    Reset usage data
                  </button>
                  <button
                    aria-busy={isUsageExporting}
                    aria-label={`Export ${usagePeriod}-day usage analytics as CSV`}
                    className="export-button"
                    disabled={isUsageLoading || isUsageExporting}
                    onClick={() => void exportUsageCsv()}
                    type="button"
                  >
                    {isUsageExporting ? "Exporting CSV…" : "Export CSV"}
                  </button>
                </div>
              ) : (
                <span />
              )}
              <button className="done-button" onClick={closeSettings} type="button">
                Done
              </button>
            </footer>
          </section>
        </div>
      ) : null}

      {isBroadcastOpen ? (
        <div className="modal-backdrop" role="presentation" onMouseDown={closeBroadcast}>
          <form
            aria-labelledby="broadcast-title"
            aria-modal="true"
            className="broadcast-dialog"
            onKeyDown={trapDialogFocus}
            onMouseDown={(event) => event.stopPropagation()}
            onSubmit={(event) => void submitBroadcast(event)}
            role="dialog"
          >
            <header className="broadcast-header">
              <div>
                <span className="dialog-kicker">Multi-provider</span>
                <h2 id="broadcast-title">Broadcast a prompt</h2>
                <p>Send now or schedule the same request across connected accounts.</p>
              </div>
              <button
                aria-label="Close broadcast composer"
                className="icon-button"
                onClick={closeBroadcast}
                ref={broadcastCloseRef}
                type="button"
              >
                <Icon name="x" />
              </button>
            </header>

            <div className="broadcast-content">
              <fieldset className="broadcast-mode">
                <legend>1. Choose a mode</legend>
                <div>
                  <label className={broadcastMode === "standard" ? "is-selected" : ""}>
                    <input
                      checked={broadcastMode === "standard"}
                      name="broadcast-mode"
                      onChange={() => setBroadcastMode("standard")}
                      type="radio"
                      value="standard"
                    />
                    <Icon name="send" size={18} />
                    <span>
                      <strong>Standard prompt</strong>
                      <small>Uses each provider’s normal conversation mode.</small>
                    </span>
                  </label>
                  <label className={broadcastMode === "deep-research" ? "is-selected" : ""}>
                    <input
                      checked={broadcastMode === "deep-research"}
                      name="broadcast-mode"
                      onChange={() => setBroadcastMode("deep-research")}
                      type="radio"
                      value="deep-research"
                    />
                    <Icon name="sparkles" size={18} />
                    <span>
                      <strong>Deep Research</strong>
                      <small>Requires support and access in each selected account.</small>
                    </span>
                  </label>
                </div>
              </fieldset>

              <fieldset className="broadcast-targets">
                <legend>2. Select connected accounts</legend>
                <small
                  className={`broadcast-target-limit ${
                    broadcastTargetLimitReached ? "is-reached" : ""
                  }`}
                  id="broadcast-target-limit"
                  role={broadcastTargetLimitReached ? "status" : undefined}
                >
                  {broadcastTargetLimitReached
                    ? "8 of 8 selected. Deselect an account before choosing another."
                    : `${broadcastAccountIds.length} of 8 selected`}
                </small>
                <div>
                  {accounts.map((account) => {
                    const checked = broadcastAccountIds.includes(account.id);
                    const unavailable =
                      !checked && broadcastTargetLimitReached;
                    const result = broadcastResults.find(
                      (delivery) => delivery.accountId === account.id
                    );
                    return (
                      <label
                        aria-disabled={unavailable}
                        className={`${checked ? "is-selected" : ""} ${
                          unavailable ? "is-disabled" : ""
                        }`}
                        key={account.id}
                      >
                        <input
                          aria-describedby="broadcast-target-limit"
                          checked={checked}
                          disabled={isBroadcasting || unavailable}
                          onChange={() => {
                            setSensitiveFindings([]);
                            setBroadcastAccountIds((current) => {
                              if (current.includes(account.id)) {
                                return current.filter((accountId) => accountId !== account.id);
                              }
                              return current.length < MAX_BROADCAST_TARGETS
                                ? [...current, account.id]
                                : current;
                            });
                          }}
                          type="checkbox"
                        />
                        <ServiceLogo serviceId={account.serviceId} size="small" />
                        <span>
                          <strong>{account.label}</strong>
                          <small>{SERVICE_BY_ID.get(account.serviceId)?.name}</small>
                        </span>
                        {result ? (
                          <span className={`delivery-status is-${result.status}`}>
                            {result.status === "submitted"
                              ? "Submitted"
                              : result.status === "unsupported"
                                ? "Unavailable"
                                : "Failed"}
                          </span>
                        ) : null}
                      </label>
                    );
                  })}
                </div>
              </fieldset>

              <section className="broadcast-template" aria-labelledby="broadcast-template-heading">
                <div className="broadcast-template-heading">
                  <div>
                    <strong id="broadcast-template-heading">3. Start from a template (optional)</strong>
                    <span>Variable values stay local and are applied only to this prompt.</span>
                  </div>
                  <select
                    aria-label="Prompt template"
                    disabled={isBroadcasting || promptTemplates.length === 0}
                    onChange={(event) => selectBroadcastTemplate(event.target.value)}
                    value={broadcastTemplateId}
                  >
                    <option value="">
                      {promptTemplates.length === 0 ? "No templates available" : "Choose a template"}
                    </option>
                    {[...promptTemplates]
                      .sort((left, right) => left.name.localeCompare(right.name))
                      .map((template) => (
                        <option key={template.id} value={template.id}>
                          {template.category ? `${template.category} · ` : ""}
                          {template.name}
                        </option>
                      ))}
                  </select>
                </div>
                {selectedBroadcastTemplate ? (
                  <div className="broadcast-template-workspace">
                    {broadcastTemplateVariables.length > 0 ? (
                      <div className="template-variable-grid">
                        {broadcastTemplateVariables.map((variable) => (
                          <label key={variable}>
                            <span>{variable}</span>
                            <input
                              aria-label={`Value for ${variable}`}
                              disabled={isBroadcasting}
                              maxLength={4_000}
                              onChange={(event) => {
                                setBroadcastTemplateValues((current) => {
                                  const next = Object.assign(emptyTemplateValues(), current);
                                  next[variable] = event.target.value;
                                  return next;
                                });
                                setBroadcastTemplateError(null);
                              }}
                              value={getTemplateValue(broadcastTemplateValues, variable) ?? ""}
                            />
                          </label>
                        ))}
                      </div>
                    ) : (
                      <p className="template-no-variables">This template has no variables.</p>
                    )}
                    <div className="template-preview">
                      <span>Preview</span>
                      <pre>{renderedTemplatePreview}</pre>
                    </div>
                    {missingBroadcastTemplateVariables.length > 0 ? (
                      <p className="template-validation" role="alert">
                        Required: enter {missingBroadcastTemplateVariables.join(", ")} before
                        applying this template.
                      </p>
                    ) : null}
                    {broadcastTemplateError ? (
                      <p className="template-validation" role="alert">
                        {broadcastTemplateError}
                      </p>
                    ) : null}
                    <button
                      className="template-apply-button"
                      disabled={isBroadcasting}
                      onClick={applyBroadcastTemplate}
                      type="button"
                    >
                      Apply to prompt
                    </button>
                  </div>
                ) : null}
              </section>

              <label className="broadcast-prompt">
                <span>4. Write or edit the prompt</span>
                <textarea
                  disabled={isBroadcasting}
                  maxLength={12_000}
                  onChange={(event) => {
                    setBroadcastPrompt(event.target.value);
                    setSensitiveFindings([]);
                  }}
                  placeholder="Ask every selected AI the same question..."
                  ref={broadcastPromptRef}
                  rows={5}
                  value={broadcastPrompt}
                />
                <small>{broadcastPrompt.length.toLocaleString()} / 12,000</small>
              </label>

              <fieldset className="broadcast-timing">
                <legend>5. Choose delivery time</legend>
                <div className="segmented-control" aria-label="Delivery time">
                  <button
                    aria-pressed={broadcastTiming === "now"}
                    className={broadcastTiming === "now" ? "is-active" : ""}
                    onClick={() => setBroadcastTiming("now")}
                    type="button"
                  >
                    Send now
                  </button>
                  <button
                    aria-pressed={broadcastTiming === "scheduled"}
                    className={broadcastTiming === "scheduled" ? "is-active" : ""}
                    onClick={() => setBroadcastTiming("scheduled")}
                    type="button"
                  >
                    Schedule
                  </button>
                </div>
                {broadcastTiming === "scheduled" ? (
                  <div className="schedule-fields">
                    <label>
                      <span>First run</span>
                      <input
                        min={toDateTimeInput(new Date(Date.now() + 60_000))}
                        onChange={(event) => setScheduleAt(event.target.value)}
                        type="datetime-local"
                        value={scheduleAt}
                      />
                    </label>
                    <label>
                      <span>Repeat</span>
                      <select
                        onChange={(event) =>
                          setScheduleRecurrence(event.target.value as ScheduleRecurrence)
                        }
                        value={scheduleRecurrence}
                      >
                        <option value="once">Once</option>
                        <option value="daily">Daily</option>
                        <option value="weekly">Weekly</option>
                      </select>
                    </label>
                    <small>
                      Runs while AI Workspace is open. Missed recurring runs advance to the next
                      future interval; one-time runs execute once on the next app start.
                    </small>
                  </div>
                ) : null}
              </fieldset>

              {broadcastMode === "deep-research" ? (
                <div className="broadcast-notice">
                  <Icon name="sparkles" size={17} />
                  <span>
                    Deep Research controls differ by provider and subscription. Accounts
                    without an available control are reported as unavailable and are not sent
                    as a standard prompt.
                  </span>
                </div>
              ) : null}

              {sensitiveFindings.length > 0 ? (
                <section className="sensitive-data-warning" role="alert" aria-labelledby="sensitive-warning-title">
                  <div className="sensitive-warning-heading">
                    <Icon name="shield" size={19} />
                    <div>
                      <strong id="sensitive-warning-title">Review sensitive information</strong>
                      <span>
                        The local check found data that may be personal, financial, confidential,
                        or a credential. Verify that every selected provider is approved for it.
                      </span>
                    </div>
                  </div>
                  <ul>
                    {sensitiveFindings.map((finding, index) => (
                      <li key={`${finding.label}-${finding.excerpt}-${index}`}>
                        <strong>{finding.label}</strong>
                        <code>{finding.excerpt}</code>
                      </li>
                    ))}
                  </ul>
                  <div className="sensitive-warning-actions">
                    <button
                      onClick={() => {
                        setSensitiveFindings([]);
                        broadcastPromptRef.current?.focus();
                      }}
                      type="button"
                    >
                      Review prompt
                    </button>
                    <button
                      className="send-anyway-button"
                      onClick={() => performBroadcastAction(true)}
                      type="button"
                    >
                      {broadcastTiming === "scheduled" ? "Schedule anyway" : "Send anyway"}
                    </button>
                  </div>
                </section>
              ) : null}

              {broadcastError ? (
                <div className="usage-error" role="alert">{broadcastError}</div>
              ) : null}

              {broadcastResults.length > 0 ? (
                <section className="broadcast-comparison" aria-live="polite">
                  <header>
                    <strong>Side-by-side delivery comparison</strong>
                    <span>
                      Open each official provider page to review its response. AI Workspace does
                      not extract or compare response content.
                    </span>
                  </header>
                  <div className="broadcast-results">
                  {broadcastResults.map((result) => {
                    const account = accounts.find(
                      (candidate) => candidate.id === result.accountId
                    );
                    if (!account) {
                      return null;
                    }
                    return (
                      <article key={result.accountId}>
                        <ServiceLogo serviceId={result.serviceId} size="small" />
                        <span>
                          <strong>{account.label}</strong>
                          <small>{result.message}</small>
                        </span>
                        <button
                          onClick={() => {
                            setIsBroadcastOpen(false);
                            void selectAccount(account.id).then(() =>
                              window.desktop.releaseBroadcastViews()
                            );
                          }}
                          type="button"
                        >
                          Open
                        </button>
                      </article>
                    );
                  })}
                  </div>
                </section>
              ) : null}
            </div>

            <footer className="broadcast-footer">
              <span>
                Prompts and schedules are stored locally. Provider responses are never
                automatically read or scraped; only content you explicitly paste into Research
                Lab is stored.
              </span>
              <button
                className="done-button"
                disabled={
                  isBroadcasting ||
                  broadcastAccountIds.length < 1 ||
                  broadcastPrompt.trim().length < 1
                }
                type="submit"
              >
                <Icon name="send" size={16} />
                {isBroadcasting
                  ? broadcastTiming === "scheduled"
                    ? "Scheduling..."
                    : "Broadcasting..."
                  : broadcastTiming === "scheduled"
                    ? `Schedule for ${broadcastAccountIds.length}`
                    : `Send to ${broadcastAccountIds.length}`}
              </button>
            </footer>
          </form>
        </div>
      ) : null}
      {isResearchOpen ? (
        <ResearchWorkspace
          accounts={accounts}
          onRegisterCloseHandler={(handler) => {
            researchCloseHandlerRef.current = handler;
          }}
          onClose={closeResearch}
          onOpenAccount={(accountId) => {
            setIsResearchOpen(false);
            void selectAccount(accountId).then(() => window.desktop.releaseBroadcastViews());
          }}
        />
      ) : null}
      {isUseCasesOpen ? (
        <UseCasesWorkspace
          accounts={accounts}
          onClose={closeUseCases}
          onOpenAccount={(accountId) => {
            setIsUseCasesOpen(false);
            void selectAccount(accountId);
          }}
          onRegisterCloseHandler={(handler) => {
            useCasesCloseHandlerRef.current = handler;
          }}
        />
      ) : null}
    </div>
  );
}
