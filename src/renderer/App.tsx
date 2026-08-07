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
import type {
  AccountProfile,
  BroadcastDeliveryResult,
  BroadcastMode,
  DataProtectionSettings,
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
  | "chevron-right"
  | "external"
  | "eye"
  | "lock"
  | "moon"
  | "plus"
  | "refresh"
  | "send"
  | "settings"
  | "shield"
  | "sparkles"
  | "type"
  | "trash"
  | "x";

type ThemePreference = "light" | "dark" | "system";
type TextSizePreference = "standard" | "large" | "extra-large";
type SettingsPage = "preferences" | "data-protection" | "usage";

interface UserPreferences {
  theme: ThemePreference;
  textSize: TextSizePreference;
  highContrast: boolean;
  reducedMotion: boolean;
  dataProtectionByService: DataProtectionSettings;
}

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

const DEFAULT_PREFERENCES: UserPreferences = {
  theme: "system",
  textSize: "standard",
  highContrast: false,
  reducedMotion: false,
  dataProtectionByService: DEFAULT_DATA_PROTECTION_SETTINGS
};

const PREFERENCES_KEY = "ai-workspace-preferences";

function isThemePreference(value: unknown): value is ThemePreference {
  return value === "light" || value === "dark" || value === "system";
}

function isTextSizePreference(value: unknown): value is TextSizePreference {
  return value === "standard" || value === "large" || value === "extra-large";
}

function loadPreferences(): UserPreferences {
  const stored = window.localStorage.getItem(PREFERENCES_KEY);
  if (!stored) {
    return DEFAULT_PREFERENCES;
  }

  try {
    const candidate: unknown = JSON.parse(stored);
    if (!candidate || typeof candidate !== "object") {
      throw new Error("Stored preferences must be an object.");
    }
    const values = candidate as Record<string, unknown>;
    if (
      !isThemePreference(values.theme) ||
      !isTextSizePreference(values.textSize) ||
      typeof values.highContrast !== "boolean" ||
      typeof values.reducedMotion !== "boolean"
    ) {
      throw new Error("Stored preferences contain invalid values.");
    }
    const protectionCandidate =
      values.dataProtectionByService &&
      typeof values.dataProtectionByService === "object"
        ? (values.dataProtectionByService as Record<string, unknown>)
        : {};
    const dataProtectionByService = { ...DEFAULT_DATA_PROTECTION_SETTINGS };
    for (const service of SERVICES) {
      const enabled = protectionCandidate[service.id];
      if (typeof enabled === "boolean") {
        dataProtectionByService[service.id] = enabled;
      }
    }
    return {
      theme: values.theme,
      textSize: values.textSize,
      highContrast: values.highContrast,
      reducedMotion: values.reducedMotion,
      dataProtectionByService
    };
  } catch (preferenceError) {
    console.error("Unable to load accessibility preferences.", preferenceError);
    return DEFAULT_PREFERENCES;
  }
}

function trapDialogFocus(event: React.KeyboardEvent<HTMLElement>) {
  if (event.key !== "Tab") {
    return;
  }
  const focusable = [
    ...event.currentTarget.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'
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
  const [broadcastMode, setBroadcastMode] = useState<BroadcastMode>("standard");
  const [broadcastPrompt, setBroadcastPrompt] = useState("");
  const [broadcastAccountIds, setBroadcastAccountIds] = useState<string[]>([]);
  const [broadcastResults, setBroadcastResults] = useState<BroadcastDeliveryResult[]>([]);
  const [broadcastError, setBroadcastError] = useState<string | null>(null);
  const [sensitiveFindings, setSensitiveFindings] = useState<SensitiveDataFinding[]>([]);
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [settingsPage, setSettingsPage] = useState<SettingsPage>("preferences");
  const [usagePeriod, setUsagePeriod] = useState<UsagePeriodDays>(7);
  const [usageSummary, setUsageSummary] = useState<UsageSummary | null>(null);
  const [isUsageLoading, setIsUsageLoading] = useState(false);
  const [usageError, setUsageError] = useState<string | null>(null);
  const [preferences, setPreferences] = useState<UserPreferences>(loadPreferences);
  const [systemDark, setSystemDark] = useState(
    () => window.matchMedia("(prefers-color-scheme: dark)").matches
  );
  const [error, setError] = useState<string | null>(null);
  const workspaceRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const settingsCloseRef = useRef<HTMLButtonElement>(null);
  const settingsButtonRef = useRef<HTMLButtonElement>(null);
  const broadcastButtonRef = useRef<HTMLButtonElement>(null);
  const broadcastCloseRef = useRef<HTMLButtonElement>(null);
  const broadcastPromptRef = useRef<HTMLTextAreaElement>(null);

  const isConnectDialogOpen = connectServiceId !== null;
  const isOverlayOpen = isConnectDialogOpen || isSettingsOpen || isBroadcastOpen;
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

  const selectAccount = useCallback(async (accountId: string) => {
    setError(null);
    setSelectedAccountId(accountId);
    setViewState(null);
    try {
      await window.desktop.selectAccount(accountId);
    } catch (selectionError) {
      setError(
        selectionError instanceof Error
          ? selectionError.message
          : "Unable to open this account."
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
    setIsSettingsOpen(true);
  }, []);

  const openBroadcast = useCallback(() => {
    setBroadcastAccountIds(accounts.map((account) => account.id));
    setBroadcastResults([]);
    setBroadcastError(null);
    setSensitiveFindings([]);
    setIsBroadcastOpen(true);
  }, [accounts]);

  const closeBroadcast = useCallback(() => {
    if (isBroadcasting) {
      return;
    }
    setIsBroadcastOpen(false);
    requestAnimationFrame(() => broadcastButtonRef.current?.focus());
  }, [isBroadcasting]);

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

  useEffect(() => {
    let disposed = false;
    void window.desktop
      .listAccounts()
      .then((storedAccounts) => {
        if (disposed) {
          return;
        }
        setAccounts(storedAccounts);
        const firstAccount = sortAccounts(storedAccounts)[0];
        if (firstAccount) {
          void selectAccount(firstAccount.id);
        }
      })
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
  }, [isBroadcastOpen, isConnectDialogOpen, isOverlayOpen, isSettingsOpen]);

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
    window.localStorage.setItem(PREFERENCES_KEY, JSON.stringify(preferences));
  }, [effectiveTheme, preferences]);

  useEffect(() => {
    void window.desktop
      .setDataProtectionSettings(preferences.dataProtectionByService)
      .catch((protectionError: unknown) => {
        console.error("Unable to apply data protection settings.", protectionError);
      });
  }, [preferences.dataProtectionByService]);

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
  }, [selectedAccountId]);

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
      const firstAccount = sortAccounts(
        accounts.filter((account) => account.serviceId === service.id)
      )[0];
      if (firstAccount) {
        event.preventDefault();
        void selectAccount(firstAccount.id);
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
    selectAccount
  ]);

  useEffect(() => {
    if (isSettingsOpen && settingsPage === "usage") {
      void loadUsageSummary(usagePeriod);
    }
  }, [isSettingsOpen, loadUsageSummary, settingsPage, usagePeriod]);

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

  const sendBroadcast = async () => {
    const prompt = broadcastPrompt.trim();
    setIsBroadcasting(true);
    setBroadcastError(null);
    setSensitiveFindings([]);
    setBroadcastResults([]);
    try {
      const result = await window.desktop.broadcastPrompt({
        accountIds: broadcastAccountIds,
        prompt,
        mode: broadcastMode
      });
      setBroadcastResults(result.deliveries);
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

  const submitBroadcast = (event: React.FormEvent) => {
    event.preventDefault();
    const prompt = broadcastPrompt.trim();
    if (!prompt || broadcastAccountIds.length < 1) {
      setBroadcastError("Choose at least one connected account and enter a prompt.");
      return;
    }
    const protectedTargetSelected = accounts.some(
      (account) =>
        broadcastAccountIds.includes(account.id) &&
        preferences.dataProtectionByService[account.serviceId]
    );
    const findings = protectedTargetSelected ? scanSensitiveData(prompt) : [];
    if (findings.length > 0) {
      setBroadcastError(null);
      setSensitiveFindings(findings);
      return;
    }
    void sendBroadcast();
  };

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <header className="brand">
          <div className="brand-mark" aria-hidden="true">A</div>
          <div>
            <strong>AI Workspace</strong>
            <span>Your AI apps in one place</span>
          </div>
        </header>

        <div className="sidebar-primary-action">
          <button className="connect-button" onClick={() => openConnectDialog()} type="button">
            <Icon name="plus" />
            <span>Connect an AI account</span>
            <kbd>Ctrl N</kbd>
          </button>
          <button
            className="broadcast-button"
            disabled={accounts.length === 0}
            onClick={openBroadcast}
            ref={broadcastButtonRef}
            type="button"
          >
            <Icon name="sparkles" />
            <span>Broadcast a prompt</span>
            <small>{accounts.length > 0 ? `${accounts.length} ready` : "Connect first"}</small>
          </button>
        </div>

        <nav className="service-list" aria-label="AI accounts">
          <div className="section-title">
            <span>Your accounts</span>
            <span>{accounts.length}</span>
          </div>

          {SERVICES.map((service) => {
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
                ) : (
                  <button
                    className="empty-service-action"
                    onClick={() => openConnectDialog(service.id)}
                    type="button"
                  >
                    <Icon name="plus" size={14} />
                    Add {service.name}
                  </button>
                )}
              </section>
            );
          })}
        </nav>

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
                  {settingsPage === "preferences"
                    ? "Preferences"
                    : settingsPage === "data-protection"
                      ? "Privacy controls"
                      : "Insights"}
                </span>
                <h2 id="settings-title">Settings</h2>
                <p>
                  {settingsPage === "preferences"
                    ? "Customize the appearance and make the interface more accessible."
                    : settingsPage === "data-protection"
                      ? "Warn before personal or company-sensitive data leaves this device."
                      : "Understand which AI services you use most."}
                </p>
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
              <button
                aria-current={settingsPage === "preferences" ? "page" : undefined}
                className={settingsPage === "preferences" ? "is-active" : ""}
                onClick={() => setSettingsPage("preferences")}
                type="button"
              >
                <Icon name="settings" size={16} />
                Preferences
              </button>
              <button
                aria-current={settingsPage === "data-protection" ? "page" : undefined}
                className={settingsPage === "data-protection" ? "is-active" : ""}
                onClick={() => setSettingsPage("data-protection")}
                type="button"
              >
                <Icon name="shield" size={16} />
                Data protection
              </button>
              <button
                aria-current={settingsPage === "usage" ? "page" : undefined}
                className={settingsPage === "usage" ? "is-active" : ""}
                onClick={() => setSettingsPage("usage")}
                type="button"
              >
                <Icon name="chart" size={16} />
                Usage
              </button>
            </nav>

            <div className="settings-content">
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
                          onClick={() => setUsagePeriod(period)}
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
              ) : (
                <button
                  className="reset-button"
                  disabled={isUsageLoading}
                  onClick={() => {
                    setIsUsageLoading(true);
                    setUsageError(null);
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
                <p>Send the same request to multiple connected AI accounts.</p>
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
                <div>
                  {accounts.map((account) => {
                    const checked = broadcastAccountIds.includes(account.id);
                    const result = broadcastResults.find(
                      (delivery) => delivery.accountId === account.id
                    );
                    return (
                      <label className={checked ? "is-selected" : ""} key={account.id}>
                        <input
                          checked={checked}
                          disabled={isBroadcasting}
                          onChange={() => {
                            setSensitiveFindings([]);
                            setBroadcastAccountIds((current) =>
                              current.includes(account.id)
                                ? current.filter((accountId) => accountId !== account.id)
                                : [...current, account.id]
                            );
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

              <label className="broadcast-prompt">
                <span>3. Write one prompt</span>
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
                      onClick={() => void sendBroadcast()}
                      type="button"
                    >
                      Send anyway
                    </button>
                  </div>
                </section>
              ) : null}

              {broadcastError ? (
                <div className="usage-error" role="alert">{broadcastError}</div>
              ) : null}

              {broadcastResults.length > 0 ? (
                <div className="broadcast-results" aria-live="polite">
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
                            void selectAccount(account.id);
                          }}
                          type="button"
                        >
                          Open
                        </button>
                      </article>
                    );
                  })}
                </div>
              ) : null}
            </div>

            <footer className="broadcast-footer">
              <span>
                Prompts are inserted locally into official provider pages. AI Workspace never
                reads or stores the responses.
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
                {isBroadcasting ? "Broadcasting..." : `Send to ${broadcastAccountIds.length}`}
              </button>
            </footer>
          </form>
        </div>
      ) : null}
    </div>
  );
}
