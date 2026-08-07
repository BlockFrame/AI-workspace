# Architecture Overview

This document explains the high-level architecture of AI Workspace.

## System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                     AI Workspace Desktop App                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────────────┐         ┌──────────────────────┐    │
│  │   Main Process       │◄───────►│  Renderer Process    │    │
│  │  (Electron Main)     │  IPC    │  (React + Vite)      │    │
│  │                      │         │                      │    │
│  │ • Window Management  │         │ • UI Components      │    │
│  │ • IPC Handlers       │         │ • State Management   │    │
│  │ • Session/Partition  │         │ • User Interactions  │    │
│  │ • Account Store      │         │ • Dialog Rendering   │    │
│  │ • Usage Analytics    │         │ • Theme Management   │    │
│  │ • Broadcast Logic    │         │ • Settings UI        │    │
│  └──────────────────────┘         └──────────────────────┘    │
│           │                               │                    │
│           ▼                               ▼                    │
│  ┌──────────────────────────────────────────────────────┐    │
│  │        WebContentsView (Embedded iframes)            │    │
│  ├──────────────────────────────────────────────────────┤    │
│  │ ChatGPT │ Claude │ Perplexity │ Gemini │ Z.AI │...  │    │
│  │ (Partition)    (Partition)    (Partition) ...       │    │
│  │ Session ID:    Session ID:    Session ID:           │    │
│  │ persist:ai-    persist:ai-    persist:ai-           │    │
│  │ workspace-...  workspace-...  workspace-...         │    │
│  └──────────────────────────────────────────────────────┘    │
│           │                                                   │
│           ▼                                                   │
│  ┌──────────────────────────────────────────────────────┐    │
│  │          Persistent Storage (Local)                 │    │
│  ├──────────────────────────────────────────────────────┤    │
│  │ ~/.ai-workspace/                                    │    │
│  │ ├── accounts.json    (account metadata)             │    │
│  │ └── usage.json       (usage analytics)              │    │
│  │                                                      │    │
│  │ Chromium Session Data:                              │    │
│  │ ├── Cookies (per partition)                         │    │
│  │ ├── Local Storage (per partition)                   │    │
│  │ └── IndexedDB (per partition)                       │    │
│  └──────────────────────────────────────────────────────┘    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Process Boundaries

### Main Process (Node.js-like environment)
- **Runs:** Electron main process
- **File:** `electron/main.ts`
- **Capabilities:**
  - Full Node.js API access (file system, networking, OS)
  - Window management (create, destroy, focus)
  - IPC communication with renderer
  - Account and usage data persistence
  - Broadcast adapter injection

- **Restrictions:**
  - Cannot directly access DOM
  - Cannot load web content (must use WebContentsView)
  - Must communicate with renderer via IPC

### Renderer Process (Web-like environment)
- **Runs:** Chromium renderer process
- **File:** `src/renderer/App.tsx` + `src/renderer/styles.css`
- **Capabilities:**
  - React state management
  - DOM manipulation and styling
  - User input handling
  - WebGL and Canvas rendering
  - IPC communication with main process

- **Restrictions:**
  - No direct file system access
  - No Node.js APIs
  - No network requests without CORS
  - Sandboxed execution

### IPC (Inter-Process Communication)
- **Bridge File:** `electron/preload.ts`
- **Type-Safe:** All IPC methods defined in `src/shared/types.ts`
- **Methods:**
  - `window.desktopApi.getAccounts()` – Fetch accounts
  - `window.desktopApi.addAccount(profile)` – Add account
  - `window.desktopApi.sendBroadcast(request)` – Send prompt to multiple services
  - `window.desktopApi.getUsageSummary(range)` – Get usage stats
  - And more (see `types.ts` for complete list)

## Security Model

### Account Isolation
Each AI service account is isolated in a **dedicated Chromium partition**:

```
Account: ChatGPT (user@example.com)
└── Partition: persist:ai-workspace-chatgpt-uuid-1
    ├── Cookies: stored locally, never shared
    ├── Session tokens: never accessible to other accounts
    └── Local storage: isolated, can't be read by other accounts

Account: Claude (researcher@company.com)
└── Partition: persist:ai-workspace-claude-uuid-2
    ├── Cookies: independent, unique session
    ├── Session tokens: isolated from ChatGPT session
    └── Local storage: completely separate
```

**Benefit:** No cross-account cookie leakage; simultaneous login to multiple accounts is safe.

### Broadcast Adapter Architecture

When sending a broadcast prompt:

1. **Validate request** in main process
2. **For each selected account:**
   - Navigate to provider's web interface
   - **Inject prompt** via safe `document.execCommand('insertText')`
   - **Find and click send button** using CSS selectors
   - **Detect Deep Research mode** availability
   - **Report result** (success, error, or unsupported mode)

**CSS Selectors per Provider:**
```javascript
const adapters = {
  chatgpt: {
    selectors: {
      messageInputs: ['[data-testid="send-button-container"]...'],
      sendButtons: ['button[data-testid="send-button"]', ...],
      researchToggles: ['[aria-label*="GPT-4o with Canvas"]', ...]
    }
  },
  // ... other providers
}
```

**Why safe:** `document.execCommand('insertText')` only triggers browser native text insertion, compatible with React (Claude) and ProseMirror (ChatGPT).

## State Management

### Account State (Persistent)
```json
{
  "accounts": [
    {
      "id": "uuid-1",
      "serviceId": "chatgpt",
      "name": "user@example.com",
      "displayName": "ChatGPT - Work",
      "createdAt": "2024-12-01T10:00:00Z"
    }
  ]
}
```
**Storage:** `~/.ai-workspace/accounts.json`
**Loaded at:** App startup
**Updated:** When accounts are added/removed/renamed

### Usage State (Persistent)
```json
{
  "chatgpt": {
    "2024-12-07": {
      "openCount": 5,
      "switchCount": 3,
      "focusedTime": 1860
    }
  }
}
```
**Storage:** `~/.ai-workspace/usage.json`
**Tracked:** Open events, switch events, focused time
**Accuracy:** Only counts time when app window and account view are both visible

### UI State (Ephemeral)
Managed in React via `useState`:
- Current active service
- Current active account
- Settings panel visibility
- Theme preference
- Broadcast form state
- Dialog open/close

**Synced on focus:** When app window refocuses, usage analytics are flushed to disk.

## Data Flow

### User Opens an Account
```
1. Click account in sidebar
   └─► React setState({ activeAccount })

2. Dispatch IPC: desktopApi.getAccountInfo(accountId)
   └─► Main process returns account metadata

3. Create/show WebContentsView for partition
   └─► Navigate to provider URL

4. Track usage: start focusing account timer
   └─► Accumulate time until user switches
```

### User Sends a Broadcast
```
1. Fill form: Select accounts, enter prompt, choose mode
   └─► React form state updated

2. Click "Send"
   └─► Dispatch IPC: desktopApi.sendBroadcast(request)

3. Main process:
   ├─► Validate request (accounts exist, etc.)
   ├─► For each selected account:
   │   ├─► Navigate WebContentsView to provider
   │   ├─► Inject prompt via document.execCommand
   │   ├─► Detect Deep Research toggle availability
   │   ├─► Click send button
   │   └─► Report result
   └─► Send aggregate results back to renderer

4. Renderer displays results
   └─► Show success, error, or "unsupported mode" per provider
```

### User Checks Usage
```
1. Click "Settings" → "Usage"
   └─► React updates tab state

2. Dispatch IPC: desktopApi.getUsageSummary('7d' | '30d')
   └─► Main process reads usage.json
   └─► Returns aggregated stats

3. Renderer displays:
   ├─► Pie chart (service breakdown)
   ├─► Bar chart (time over days)
   └─► Top 3 services
```

## File Organization

```
ai-workspace/
│
├── electron/                    # Main process
│   ├── main.ts                 # Core: window, IPC, sessions, accounts, usage, broadcast
│   └── preload.ts              # Secure typed bridge to renderer
│
├── src/
│   ├── renderer/               # Renderer process (React + Vite)
│   │   ├── App.tsx            # Main component: all UI (1400 lines)
│   │   ├── styles.css         # All styling + themes (1400 lines)
│   │   ├── global.d.ts        # TypeScript declarations (SVGs)
│   │   └── assets.d.ts        # Asset import types
│   │
│   └── shared/                 # Shared types (used by both processes)
│       ├── types.ts           # TypeScript interfaces & contracts
│       └── services.ts        # Service registry (8 AI providers)
│
├── .github/
│   ├── workflows/             # GitHub Actions CI/CD
│   │   ├── build.yml         # Test, type check, build
│   │   └── release.yml       # Package and release
│   │
│   ├── ISSUE_TEMPLATE/       # Issue templates
│   │   ├── bug_report.md
│   │   └── feature_request.md
│   │
│   ├── pull_request_template.md
│   ├── CODEOWNERS            # Code owner assignments
│   └── README.md             # Workflow documentation
│
├── index.html                # App entry point
├── package.json              # Dependencies & build config
├── tsconfig.json             # Root TypeScript config
├── tsconfig.main.json        # Main process TypeScript
├── tsconfig.renderer.json    # Renderer TypeScript
├── vite.config.ts            # Vite build config (CSP)
│
├── .gitignore
├── .npmrc
├── LICENSE                   # MIT License
├── README.md                 # Project documentation
├── CONTRIBUTING.md           # Contribution guidelines
├── SECURITY.md              # Security policy
└── CHANGELOG.md             # Release notes
```

## Build & Deployment Flow

```
Development (npm run dev)
│
├─► Vite dev server (port 5173)
│   └─► Renderer hot reload
│
├─► TypeScript watcher
│   └─► Main process recompile
│
└─► Electron launch
    └─► Dev window with debug tools

Production (npm run build && npm run package)
│
├─► TypeScript build
│   ├─► Main: electron/main.ts → dist-electron/
│   └─► Renderer: src/renderer/ → dist/
│
├─► Vite build (production)
│   └─► Generate optimized bundle
│
├─► Electron Builder packaging
│   ├─► Embed app in ASAR archive
│   ├─► Create NSIS installer
│   └─► Generate .exe (uncompressed for testing)
│
└─► Release artifacts
    ├─► release/AI Workspace Setup.exe (installer)
    └─► release-*/AI Workspace.exe (portable)
```

## Performance Considerations

### Memory
- **WebContentsView lifecycle:** Views are created on-demand, destroyed when not visible
- **Partition persistence:** Each partition retains session data (intentional for UX)
- **Usage data:** Loaded once at startup; written on flush events

### CPU
- **Focus/blur events:** Tracked to accurately count focused time
- **Broadcast injection:** Concurrent requests per provider (not sequential)
- **Rendering:** Only active view is visible; others are background processes

### Disk I/O
- **Account writes:** Batched into single JSON file; written on account changes
- **Usage writes:** Flushed when (1) app loses focus, (2) window closes, (3) timer fires
- **Session data:** Handled by Chromium internally (transparent)

## Future Extensibility

### Adding a New Provider
1. Update `ServiceId` union in `types.ts`
2. Add service to `SERVICES` array in `services.ts`
3. Add auth domain allowlist in `AUTH_HOSTS_BY_SERVICE` (main.ts)
4. Create broadcast adapter (CSS selectors, mode names)
5. Import and add icon in App.tsx
6. Run tests: add mock account, send broadcast

### Adding a New Broadcast Mode
1. Define new mode name in service adapter
2. Detect mode availability in adapter (update CSS selectors)
3. Add UI toggle in broadcast composer (if needed)
4. Test per provider

---

**Maintained by:** blockframe team
**Last updated:** December 2024
