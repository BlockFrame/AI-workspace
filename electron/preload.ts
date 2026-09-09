import { contextBridge, ipcRenderer } from "electron";
import type {
  AccountProfile,
  AccountProviderSettings,
  AppPreferences,
  AppUpdateStatus,
  BroadcastRequest,
  BroadcastResult,
  CreateScheduleRequest,
  DataProtectionSettings,
  DesktopApi,
  ExportUsageCsvResult,
  PromptHistoryEntry,
  PromptTemplate,
  PromptTemplateInput,
  ProviderSelectionResult,
  RemoveAccountResult,
  ResetUsageResult,
  ScheduledPrompt,
  ServiceId,
  UsagePeriodDays,
  UsageSummary,
  ViewBounds,
  ViewState
} from "../src/shared/types";
import type {
  AddResearchRoundInput,
  CreateResearchProjectInput,
  ResearchProject,
  UpdateResearchRoundInput
} from "../src/shared/research-types";
import type {
  CreateGeoStudyInput,
  GeoStudy,
  GeoStudyProgressEvent,
  UpdateGeoResultInput
} from "../src/shared/geo-types";

const desktopApi: DesktopApi = {
  listAccounts: () => ipcRenderer.invoke("accounts:list") as Promise<AccountProfile[]>,
  addAccount: (serviceId: ServiceId, label: string) =>
    ipcRenderer.invoke("accounts:add", serviceId, label) as Promise<AccountProfile[]>,
  removeAccount: (accountId: string) =>
    ipcRenderer.invoke("accounts:remove", accountId) as Promise<RemoveAccountResult>,
  selectAccount: (accountId: string) =>
    ipcRenderer.invoke("views:select", accountId) as Promise<AccountProfile[]>,
  selectRecentAccount: (serviceId: ServiceId) =>
    ipcRenderer.invoke("views:select-recent", serviceId) as Promise<ProviderSelectionResult>,
  setViewBounds: (bounds: ViewBounds) => ipcRenderer.send("views:set-bounds", bounds),
  setViewVisible: (visible: boolean) => ipcRenderer.send("views:set-visible", visible),
  goBack: () => ipcRenderer.invoke("views:go-back") as Promise<void>,
  goForward: () => ipcRenderer.invoke("views:go-forward") as Promise<void>,
  reload: () => ipcRenderer.invoke("views:reload") as Promise<void>,
  openCurrentInBrowser: () =>
    ipcRenderer.invoke("views:open-current-external") as Promise<void>,
  getUsageSummary: (periodDays: UsagePeriodDays) =>
    ipcRenderer.invoke("usage:summary", periodDays) as Promise<UsageSummary>,
  exportUsageCsv: (periodDays: UsagePeriodDays) =>
    ipcRenderer.invoke("usage:export-csv", periodDays) as Promise<ExportUsageCsvResult>,
  resetUsage: (periodDays: UsagePeriodDays) =>
    ipcRenderer.invoke("usage:reset", periodDays) as Promise<ResetUsageResult>,
  getPreferences: () =>
    ipcRenderer.invoke("preferences:get") as Promise<AppPreferences>,
  setPreferences: (preferences: AppPreferences) =>
    ipcRenderer.invoke("preferences:set", preferences) as Promise<AppPreferences>,
  getUpdateStatus: () =>
    ipcRenderer.invoke("updates:get-status") as Promise<AppUpdateStatus>,
  checkForUpdates: () =>
    ipcRenderer.invoke("updates:check") as Promise<AppUpdateStatus>,
  downloadUpdate: () =>
    ipcRenderer.invoke("updates:download") as Promise<AppUpdateStatus>,
  installUpdate: () =>
    ipcRenderer.invoke("updates:install") as Promise<void>,
  setDataProtectionSettings: (settings: DataProtectionSettings) =>
    ipcRenderer.invoke("data-protection:set", settings) as Promise<void>,
  listAccountSettings: () =>
    ipcRenderer.invoke("account-settings:list") as Promise<AccountProviderSettings[]>,
  updateAccountSettings: (accountId, settings) =>
    ipcRenderer.invoke("account-settings:update", accountId, settings) as Promise<AccountProviderSettings>,
  listPromptHistory: () =>
    ipcRenderer.invoke("history:list") as Promise<PromptHistoryEntry[]>,
  clearPromptHistory: () => ipcRenderer.invoke("history:clear") as Promise<void>,
  listPromptTemplates: () =>
    ipcRenderer.invoke("prompt-templates:list") as Promise<PromptTemplate[]>,
  createPromptTemplate: (input: PromptTemplateInput) =>
    ipcRenderer.invoke("prompt-templates:create", input) as Promise<PromptTemplate>,
  updatePromptTemplate: (id: string, input: PromptTemplateInput) =>
    ipcRenderer.invoke("prompt-templates:update", id, input) as Promise<PromptTemplate>,
  deletePromptTemplate: (id: string) =>
    ipcRenderer.invoke("prompt-templates:delete", id) as Promise<boolean>,
  listSchedules: () =>
    ipcRenderer.invoke("schedules:list") as Promise<ScheduledPrompt[]>,
  createSchedule: (request: CreateScheduleRequest) =>
    ipcRenderer.invoke("schedules:create", request) as Promise<ScheduledPrompt>,
  setScheduleEnabled: (scheduleId: string, enabled: boolean) =>
    ipcRenderer.invoke("schedules:set-enabled", scheduleId, enabled) as Promise<ScheduledPrompt>,
  removeSchedule: (scheduleId: string) =>
    ipcRenderer.invoke("schedules:remove", scheduleId) as Promise<void>,
  listResearchProjects: () =>
    ipcRenderer.invoke("research:list") as Promise<ResearchProject[]>,
  createResearchProject: (input: CreateResearchProjectInput) =>
    ipcRenderer.invoke("research:create", input) as Promise<ResearchProject>,
  addResearchRound: (projectId: string, input: AddResearchRoundInput) =>
    ipcRenderer.invoke("research:add-round", projectId, input) as Promise<ResearchProject>,
  updateResearchRound: (
    projectId: string,
    roundId: string,
    input: UpdateResearchRoundInput
  ) =>
    ipcRenderer.invoke(
      "research:update-round",
      projectId,
      roundId,
      input
    ) as Promise<ResearchProject>,
  deleteResearchProject: (projectId: string) =>
    ipcRenderer.invoke("research:delete", projectId) as Promise<boolean>,
  broadcastResearchPrompt: (request: BroadcastRequest) =>
    ipcRenderer.invoke("research:broadcast", request) as Promise<BroadcastResult>,
  listGeoStudies: () =>
    ipcRenderer.invoke("geo:list") as Promise<GeoStudy[]>,
  createGeoStudy: (input: CreateGeoStudyInput) =>
    ipcRenderer.invoke("geo:create", input) as Promise<GeoStudy>,
  startGeoStudy: (studyId: string) =>
    ipcRenderer.invoke("geo:start", studyId) as Promise<GeoStudy>,
  pauseGeoStudy: (studyId: string) =>
    ipcRenderer.invoke("geo:pause", studyId) as Promise<GeoStudy>,
  retryGeoStudyFailures: (studyId: string) =>
    ipcRenderer.invoke("geo:retry-failures", studyId) as Promise<GeoStudy>,
  updateGeoResult: (
    studyId: string,
    resultId: string,
    input: UpdateGeoResultInput
  ) =>
    ipcRenderer.invoke("geo:update-result", studyId, resultId, input) as Promise<GeoStudy>,
  deleteGeoStudy: (studyId: string) =>
    ipcRenderer.invoke("geo:delete", studyId) as Promise<boolean>,
  broadcastPrompt: (request: BroadcastRequest) =>
    ipcRenderer.invoke("broadcast:send", request) as Promise<BroadcastResult>,
  releaseBroadcastViews: () =>
    ipcRenderer.invoke("broadcast:release-views") as Promise<void>,
  confirmAppClose: () => ipcRenderer.send("app:close-confirmed"),
  cancelAppClose: () => ipcRenderer.send("app:close-cancelled"),
  onViewState: (listener: (state: ViewState) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, state: ViewState) => listener(state);
    ipcRenderer.on("views:state", handler);
    return () => ipcRenderer.removeListener("views:state", handler);
  },
  onAppBeforeClose: (listener: () => void) => {
    const handler = () => listener();
    ipcRenderer.on("app:before-close", handler);
    return () => ipcRenderer.removeListener("app:before-close", handler);
  },
  onGeoStudyProgress: (listener: (event: GeoStudyProgressEvent) => void) => {
    const handler = (
      _event: Electron.IpcRendererEvent,
      progress: GeoStudyProgressEvent
    ) => listener(progress);
    ipcRenderer.on("geo:progress", handler);
    return () => ipcRenderer.removeListener("geo:progress", handler);
  },
  onSchedulesChanged: (listener: (schedules: ScheduledPrompt[]) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, schedules: ScheduledPrompt[]) =>
      listener(schedules);
    ipcRenderer.on("schedules:changed", handler);
    return () => ipcRenderer.removeListener("schedules:changed", handler);
  },
  onProviderShortcut: (listener: (serviceId: ServiceId) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, serviceId: ServiceId) =>
      listener(serviceId);
    ipcRenderer.on("shortcuts:provider", handler);
    return () => ipcRenderer.removeListener("shortcuts:provider", handler);
  },
  onPreferencesChanged: (listener: (preferences: AppPreferences) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, preferences: AppPreferences) =>
      listener(preferences);
    ipcRenderer.on("preferences:changed", handler);
    return () => ipcRenderer.removeListener("preferences:changed", handler);
  },
  onUpdateStatus: (listener: (status: AppUpdateStatus) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, status: AppUpdateStatus) =>
      listener(status);
    ipcRenderer.on("updates:status", handler);
    return () => ipcRenderer.removeListener("updates:status", handler);
  }
};

contextBridge.exposeInMainWorld("desktop", desktopApi);
