# AI Workspace

A professional desktop application for seamlessly navigating, managing, and comparing multiple AI services in one unified workspace.

<div align="center">

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Electron](https://img.shields.io/badge/Electron-43.3.0-9feaf9?logo=electron&logoColor=fff)](https://www.electronjs.org)
[![React](https://img.shields.io/badge/React-19-61dafb?logo=react&logoColor=fff)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178c6?logo=typescript&logoColor=fff)](https://www.typescriptlang.org)
[![Windows](https://img.shields.io/badge/Windows-Supported-0078d4?logo=windows)](https://www.microsoft.com/windows)

</div>

## 🎯 Overview

**AI Workspace** is a feature-rich desktop application that aggregates eight popular AI services into a single, unified interface. Switch seamlessly between accounts, broadcast the same prompt to multiple providers simultaneously, and monitor usage patterns—all with enterprise-grade security and accessibility.

### Supported AI Services

- 🤖 **ChatGPT** – OpenAI's flagship conversational AI
- 🧠 **Claude** – Anthropic's advanced reasoning AI
- 🔍 **Perplexity** – Real-time web-informed AI search
- ✨ **Gemini** – Google's multimodal AI
- ⚡ **Z.AI** – High-performance inference
- 🚀 **DeepSeek** – Advanced reasoning with DeepThink mode
- 🤖 **Kimi** – Conversational AI assistant
- 🌟 **Mistral Vibe** – Fast generative AI

## ✨ Features

### Core Capabilities
- **Multi-Account Management** – Maintain isolated sessions for each AI service; log in once and stay logged in across sessions
- **Account Switching** – Instantly switch between different accounts and providers
- **Prompt Broadcasting** – Send the same prompt to multiple AI services simultaneously (Standard or Deep Research modes)
- **Sensitive Data Alerts** – Locally inspect direct and broadcast prompts for common PII, financial data, credentials, and confidential-business markers before sending
- **Local Usage Analytics** – Track which AI services you use most with 7-day and 30-day summaries (completely local, no data sharing)
- **Provider Icons** – Official brand icons for all 8 AI services

### Security & Privacy
- **Isolated Chromium Partitions** – Each account uses dedicated persistent sessions; no cross-account cookie leakage
- **Electron Hardening** – Context isolation, sandbox mode, restricted external URLs (HTTPS only)
- **Service-Specific Auth Allowlists** – Granular control over trusted authentication domains
- **Zero External Analytics** – All data stays on your device; no telemetry or tracking
- **Per-Provider Protection Controls** – Enable alerts for every provider at once or configure each tool independently from Settings
- **Security Audit Verified** – Independent security review with zero vulnerabilities

### Accessibility & Localization
- **Dark/Light/High-Contrast Modes** – Full theme support with persistent user preferences
- **Text Scaling** – Adjustable text size for improved readability
- **Reduced Motion** – Respect for users who prefer reduced animations
- **Keyboard Navigation** – Complete keyboard support; no mouse required
- **Focus Trapping** – Accessible dialogs with proper focus management
- **English Localization** – Complete English UI with professional terminology

### User Experience
- **Guided Onboarding** – Three-step setup flow for new users
- **Settings Dashboard** – Preferences tab for themes, accessibility, and reset options
- **Usage Dashboard** – Visual breakdown of AI service usage over time
- **Broadcast Composer** – Intuitive multi-provider prompt interface

## 🚀 Quick Start

### Prerequisites
- **Node.js** 18+ and npm 9+
- **Windows 10+** (macOS/Linux builds untested but possible)

### Installation

1. Clone the repository:
```bash
git clone https://github.com/blockframe/ai-workspace.git
cd ai-workspace
```

2. Install dependencies:
```bash
npm install
```

3. Run in development mode:
```bash
npm run dev
```

The application will open automatically. You can now:
- Add accounts for each AI service
- Switch between providers
- Use the Broadcast feature to send prompts to multiple services
- Monitor usage in the Usage dashboard

### Building for Production

```bash
# TypeScript type check + build
npm run build

# Package as Windows executable
npm run package
```

The packaged installer will be available in the `release/` directory.

## 📁 Project Structure

```
ai-workspace/
├── electron/                    # Electron main process
│   ├── main.ts                 # App lifecycle, IPC handlers, session management
│   └── preload.ts              # Secure renderer-to-main bridge
├── src/
│   ├── renderer/               # React UI (Vite)
│   │   ├── App.tsx             # Main app component (1400+ lines)
│   │   ├── styles.css          # All styling + themes (1400+ lines)
│   │   ├── global.d.ts         # TypeScript declarations
│   │   └── assets.d.ts         # SVG import declarations
│   └── shared/
│       ├── types.ts            # TypeScript interfaces (DesktopApi, UsageSummary, etc.)
│       └── services.ts         # Service registry (all 8 AI providers)
├── index.html                  # Entry point
├── package.json                # Dependencies, build config, Electron Builder
├── tsconfig.json               # Root TypeScript config
├── tsconfig.main.json          # Electron main process config
├── tsconfig.renderer.json      # Renderer process config
├── vite.config.ts              # Vite + CSP configuration
├── .github/                    # GitHub Actions workflows and templates
│   ├── workflows/
│   │   ├── build.yml           # CI/CD build validation
│   │   └── release.yml         # Automated release packaging
│   ├── ISSUE_TEMPLATE/
│   │   ├── bug_report.md
│   │   └── feature_request.md
│   └── pull_request_template.md
├── LICENSE                     # MIT License
├── CONTRIBUTING.md             # Contribution guidelines
├── SECURITY.md                 # Vulnerability disclosure policy
├── CHANGELOG.md                # Release notes and version history
└── .gitignore                  # Git exclusions (Node, build artifacts, OS files)
```

### Key Files Explained

| File | Purpose | Size |
|------|---------|------|
| `electron/main.ts` | Core Electron lifecycle, session/partition management, IPC handlers, broadcast adapters | ~1300 lines |
| `src/renderer/App.tsx` | Complete React UI—onboarding, sidebar, accounts, broadcast composer, settings, usage dashboard | ~1400 lines |
| `src/shared/types.ts` | TypeScript interfaces for ServiceId, AccountProfile, UsageSummary, BroadcastRequest/Result, DesktopApi | ~200 lines |
| `src/shared/services.ts` | Service registry with metadata (id, name, homeUrl, trustedHosts) for all 8 providers | ~100 lines |
| `src/renderer/styles.css` | Complete styling with light/dark/high-contrast themes, accessibility features, responsive layout | ~1400 lines |

## 🔧 Development

### Scripts

```bash
# Development mode with hot reload
npm run dev

# Type checking only
npm run typecheck

# Build main + renderer (production)
npm run build

# Build main process
npm run build:main

# Build renderer (Vite)
npm run build:renderer

# Start packaged app
npm start

# Package as installer
npm run package
```

### Development Workflow

1. **Start the dev server:**
   ```bash
   npm run dev
   ```
   This runs Vite (port 5173), TypeScript watcher, and Electron concurrently.

2. **Make changes:**
   - Modify `electron/main.ts` → Auto-recompiled, app restarts
   - Modify `src/renderer/` → Hot-module reload in dev window
   - Modify `src/shared/` → Both sides recompile

3. **Test your changes:**
   - Use browser DevTools: `Ctrl+Shift+I`
   - Check console for errors
   - Test all 8 providers in accounts list

4. **Build for release:**
   ```bash
   npm run build && npm run package
   ```

### Understanding the Architecture

#### Electron Main Process (`electron/main.ts`)
- Manages window lifecycle and IPC
- Stores accounts in `~/.ai-workspace/accounts.json` (encrypted)
- Stores usage metrics in `~/.ai-workspace/usage.json`
- Creates isolated Chromium partitions for each account
- Implements broadcast adapters for prompt injection
- Enforces security policies (CSP, HTTPS, navigation guards)

#### React Renderer (`src/renderer/App.tsx`)
- Single-page application with state management
- Components: Onboarding, Sidebar, Account List, Broadcast Composer, Settings, Usage Dashboard
- Communicates with main process via typed IPC bridge

#### Type Safety (`src/shared/types.ts`)
- Defines `DesktopApi` contract for all IPC channels
- Ensures type safety across process boundary
- Single source of truth for data structures

### Security Considerations

**Account Isolation:**
- Each account uses a dedicated Chromium session: `persist:ai-workspace-{serviceId}-{uuid}`
- Sessions are independent; cookies and local storage never leak between accounts
- Sessions persist across app restarts

**Network Security:**
- Only HTTPS external URLs allowed
- Service-specific auth domain allowlists (see `AUTH_HOSTS_BY_SERVICE` in main.ts)
- Navigation and popup blocking prevents unexpected redirects

**Broadcast Safety:**
- Prompts injected via `document.execCommand('insertText')` only
- No arbitrary code execution in iframes
- Deep Research mode availability checked before use; unsupported mode reported explicitly
- Sensitive-data checks run locally before submission and show only masked excerpts

**Sensitive Data Alerts:**
- Enabled by default for all providers and configurable globally or per tool
- Protects both prompts typed directly into provider pages and Broadcast prompts
- Detects common patterns, including email addresses, phone numbers, tax identifiers, IBANs, valid payment card numbers, API keys, tokens, private keys, passwords, and confidential-business labels
- Alerts are advisory: users must still review context because automated detection can produce false positives or miss context-specific sensitive data

**Electron Hardening (v43.3.0):**
- `contextIsolation: true` – Main and renderer processes isolated
- `sandbox: true` – Renderer process sandboxed
- `nodeIntegration: false` – No Node.js in renderer
- `webSecurity: true` – Same-origin policy enforced
- CSP headers for development and production

## 📊 Usage Analytics

Usage metrics are stored **locally** in `~/.ai-workspace/usage.json`:

```json
{
  "chatgpt": {
    "2024-12-07": { "openCount": 2, "switchCount": 1, "focusedTime": 1860 }
  },
  "claude": {
    "2024-12-07": { "openCount": 1, "switchCount": 0, "focusedTime": 300 }
  }
}
```

**Tracked metrics:**
- `openCount` – Times the service was opened
- `switchCount` – Times you switched to this service
- `focusedTime` – Seconds the service window was active and visible (not obstructed by Settings/dialogs)

**What's NOT tracked:**
- Token usage or API costs (no access to provider billing APIs)
- Conversation content (no data collection)
- External telemetry (zero third-party analytics)
- Network requests (all processing is local)

## 🔐 Security & Privacy

### Data Location
- **Accounts:** Stored locally in `~/.ai-workspace/accounts.json`
- **Usage:** Stored locally in `~/.ai-workspace/usage.json`
- **No cloud sync:** All data remains on your device
- **No telemetry:** Zero external analytics

### Authentication
- Each AI provider's official login page is loaded in an isolated partition
- Credentials are managed by each provider (you control them)
- App never sees or stores credentials
- OAuth tokens/cookies stored in isolated persistent sessions

### Permissions
- Desktop files access: Only `~/.ai-workspace/` directory
- Network: HTTPS only, service-specific domains
- Window management: Single-window model, no external processes
- Clipboard: Not accessed (manual copy/paste only)

### Security Audit Results
✅ Electron 43.3.0 hardening verified
✅ Zero npm vulnerabilities
✅ Navigation and popup guards effective
✅ Isolated sessions prevent cross-account leakage
✅ CSP enforced in production

See [SECURITY.md](SECURITY.md) for vulnerability disclosure.

## 🌍 Platform Support

| Platform | Status | Notes |
|----------|--------|-------|
| Windows | ✅ Fully supported | Tested on Windows 10+ |
| macOS | ⚠️ Possible but untested | Requires dmg/zip build config |
| Linux | ⚠️ Possible but untested | Requires AppImage/deb build config |

Currently, only **Windows packaging** is tested and included in releases. Contributions for macOS/Linux builds welcome.

## 📝 Licensing & Contributing

This project is licensed under the **MIT License** – see [LICENSE](LICENSE) for details.

We welcome contributions! Please read [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines on:
- Code style and conventions
- Commit message format
- Pull request process
- Testing requirements

## 🐛 Reporting Issues

Found a bug or have a feature request?

1. **Security Issues:** Please follow [SECURITY.md](SECURITY.md) for responsible disclosure
2. **Bug Reports:** Use the [Bug Report](https://github.com/blockframe/ai-workspace/issues/new?template=bug_report.md) template
3. **Feature Requests:** Use the [Feature Request](https://github.com/blockframe/ai-workspace/issues/new?template=feature_request.md) template

## 📚 Documentation

- **[CONTRIBUTING.md](CONTRIBUTING.md)** – How to contribute
- **[SECURITY.md](SECURITY.md)** – Security policy and vulnerability reporting
- **[CHANGELOG.md](CHANGELOG.md)** – Release notes and version history
- **[LICENSE](LICENSE)** – MIT License

## 🎓 FAQ

### Q: Is my data shared with anyone?
**A:** No. All data (accounts, usage, settings) is stored locally on your device. Zero telemetry.

### Q: Can I use multiple accounts with the same AI provider?
**A:** Yes! Each account has its own isolated session. Switch between them instantly.

### Q: Does the app work offline?
**A:** No, you need internet to access the AI services. The app itself is offline-capable but won't load the providers without connectivity.

### Q: Can I broadcast to just some providers?
**A:** Yes, you select which accounts to include before sending. Only selected accounts receive the prompt.

### Q: What if a provider adds Deep Research but it's not detected?
**A:** The app will report "Unsupported" rather than silently falling back to standard mode. Check the broadcast result and see [CONTRIBUTING.md](CONTRIBUTING.md) to help update the adapter.

### Q: How accurate is the usage tracking?
**A:** Usage tracks active time only when (1) the app window is focused, (2) the account is active, and (3) the provider window is visible (not covered by Settings/dialogs). It's approximate but useful for trend analysis.

### Q: Can you add more AI providers?
**A:** Absolutely! See [CONTRIBUTING.md](CONTRIBUTING.md) for adding new services. The process is straightforward: register the service, add auth domains, create a broadcast adapter.

## 🤝 Community

- 📧 **Issues & Discussions:** Use GitHub Issues and Discussions
- 🔄 **Pull Requests:** Welcome for bug fixes, features, and documentation
- ⭐ **Star this repo** if you find it useful!

## 📄 Citation

If you use AI Workspace in your research or projects, please cite:

```bibtex
@software{ai_workspace_2024,
  title={AI Workspace: A Desktop Application for Multi-Provider AI Aggregation},
  author={blockframe},
  year={2024},
  url={https://github.com/blockframe/ai-workspace}
}
```

## 📄 Disclaimer

AI Workspace is an independent project and is **not affiliated** with OpenAI, Anthropic, Google, Mistral AI, or any other AI service provider. It simply provides a unified interface to access their public web applications.

---

**Made with ❤️ by the AI Workspace community**

*Last updated: December 2024*
