import { contextBridge, ipcRenderer } from "electron";
import type {
  AccountProfile,
  BroadcastRequest,
  BroadcastResult,
  DataProtectionSettings,
  DesktopApi,
  RemoveAccountResult,
  ResetUsageResult,
  ServiceId,
  UsagePeriodDays,
  UsageSummary,
  ViewBounds,
  ViewState
} from "../src/shared/types";

const desktopApi: DesktopApi = {
  listAccounts: () => ipcRenderer.invoke("accounts:list") as Promise<AccountProfile[]>,
  addAccount: (serviceId: ServiceId, label: string) =>
    ipcRenderer.invoke("accounts:add", serviceId, label) as Promise<AccountProfile[]>,
  removeAccount: (accountId: string) =>
    ipcRenderer.invoke("accounts:remove", accountId) as Promise<RemoveAccountResult>,
  selectAccount: (accountId: string) =>
    ipcRenderer.invoke("views:select", accountId) as Promise<void>,
  setViewBounds: (bounds: ViewBounds) => ipcRenderer.send("views:set-bounds", bounds),
  setViewVisible: (visible: boolean) => ipcRenderer.send("views:set-visible", visible),
  goBack: () => ipcRenderer.invoke("views:go-back") as Promise<void>,
  goForward: () => ipcRenderer.invoke("views:go-forward") as Promise<void>,
  reload: () => ipcRenderer.invoke("views:reload") as Promise<void>,
  openCurrentInBrowser: () =>
    ipcRenderer.invoke("views:open-current-external") as Promise<void>,
  getUsageSummary: (periodDays: UsagePeriodDays) =>
    ipcRenderer.invoke("usage:summary", periodDays) as Promise<UsageSummary>,
  resetUsage: (periodDays: UsagePeriodDays) =>
    ipcRenderer.invoke("usage:reset", periodDays) as Promise<ResetUsageResult>,
  setDataProtectionSettings: (settings: DataProtectionSettings) =>
    ipcRenderer.invoke("data-protection:set", settings) as Promise<void>,
  broadcastPrompt: (request: BroadcastRequest) =>
    ipcRenderer.invoke("broadcast:send", request) as Promise<BroadcastResult>,
  onViewState: (listener: (state: ViewState) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, state: ViewState) => listener(state);
    ipcRenderer.on("views:state", handler);
    return () => ipcRenderer.removeListener("views:state", handler);
  }
};

contextBridge.exposeInMainWorld("desktop", desktopApi);
