<div align="center">

# 🚀 AI Workspace

<p align="center">
  <strong>A professional desktop application for seamlessly managing and comparing multiple AI services in one unified workspace.</strong>
</p>

![AI Workspace](https://img.shields.io/badge/AI%20Workspace-v1.0.0-blue?style=for-the-badge&logo=rocket)
![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178c6?style=for-the-badge&logo=typescript&logoColor=fff)
![React](https://img.shields.io/badge/React-19-61dafb?style=for-the-badge&logo=react&logoColor=fff)
![Electron](https://img.shields.io/badge/Electron-43.3.0-9feaf9?style=for-the-badge&logo=electron&logoColor=000)
![Windows](https://img.shields.io/badge/Windows-10+-0078d4?style=for-the-badge&logo=windows&logoColor=fff)
![License MIT](https://img.shields.io/badge/License-MIT-yellow?style=for-the-badge)
![0 Vulnerabilities](https://img.shields.io/badge/Security-0%20Vulnerabilities-green?style=for-the-badge)

<br/>

**[Features](#-features) • [Quick Start](#-quick-start) • [Documentation](#-documentation) • [Contributing](#-contributing) • [License](#-license)**

</div>

---

## ✨ Highlights

<table>
  <tr>
    <td align="center">
      <h3>🎯 8 AI Providers</h3>
      ChatGPT, Claude, Perplexity, Gemini, Z.AI, DeepSeek, Kimi & Mistral
    </td>
    <td align="center">
      <h3>🔄 Broadcast Prompts</h3>
      Send to multiple services simultaneously & compare responses
    </td>
    <td align="center">
      <h3>📊 Usage Analytics</h3>
      Local 7/30-day tracking with visual dashboards
    </td>
  </tr>
  <tr>
    <td align="center">
      <h3>🔐 Enterprise Security</h3>
      Electron hardening, context isolation, CSP
    </td>
    <td align="center">
      <h3>🛡️ Sensitive Data Detection</h3>
      PII/credentials alerts before sending
    </td>
    <td align="center">
      <h3>♿ Accessibility First</h3>
      WCAG 2.1 AA, dark/light/high-contrast modes
    </td>
  </tr>
</table>

---

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

## ✨ Key Features

<div align="center">

### 🎮 Core Features
| Feature | Description |
|---------|-------------|
| 🔀 **Multi-Account Switching** | Instant account switching across all 8 providers with persistent sessions |
| 📢 **Broadcast Prompts** | Send identical prompts to multiple services simultaneously |
| 📊 **Usage Analytics** | Track provider usage with 7/30-day reports & visual dashboards |
| 🛡️ **Sensitive Data Detection** | Real-time PII/credentials detection (email, phone, card numbers, etc.) |
| 🎨 **Accessibility** | Full WCAG 2.1 AA compliance with 4 theme modes |
| 🔒 **Zero Telemetry** | All data stored locally—zero cloud sync, zero external analytics |

### 🔐 Security Features
- **Isolated Chromium Partitions** – Each account uses dedicated persistent sessions
- **Electron Hardening** – Context isolation, sandbox mode, CSP enforcement
- **Service-Specific Auth Allowlists** – Granular control over trusted domains
- **Per-Provider Protection** – Enable alerts for all or configure individually
- **Security Audit Verified** – 0 vulnerabilities, independently reviewed

### 📱 Accessibility
- **Dark/Light/High-Contrast Modes** – Full theme support
- **Text Scaling** – Adjustable font sizes
- **Keyboard Navigation** – Complete keyboard support
- **Focus Management** – Accessible dialogs with proper focus handling
- **Reduced Motion** – Respect for users preferring reduced animations

</div>

## 🚀 Quick Start

### 📋 Prerequisites

- **Node.js** 18+ and npm 9+
- **Windows 10+** (macOS/Linux possible but untested)

### ⚡ Installation & Development

<details>
<summary><strong>For Users (Packaged App)</strong></summary>

1. Download the latest **Windows installer** from [Releases](https://github.com/BlockFrame/AI-workspace/releases)
2. Run the installer
3. Launch "AI Workspace" from Start Menu
4. Add your first account and start comparing AI services!

</details>

<details>
<summary><strong>For Developers (From Source)</strong></summary>

```bash
# 1. Clone the repository
git clone https://github.com/BlockFrame/AI-workspace.git
cd AI-workspace

# 2. Install dependencies
npm install

# 3. Run in development mode (with hot reload)
npm run dev

# The app opens automatically. Try:
# - Add accounts for each AI service
# - Switch between providers
# - Test Broadcast feature
# - Monitor Usage dashboard

# 4. Build for production
npm run build

# 5. Create Windows installer
npm run package

# Output: release/AI-workspace-1.0.0.exe
```

</details>

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

## 🛠️ Development

### 📦 Build Scripts

<table>
<tr><th>Command</th><th>Description</th></tr>
<tr><td><code>npm run dev</code></td><td>⚡ Development mode with hot reload (Vite + Electron)</td></tr>
<tr><td><code>npm run typecheck</code></td><td>✅ TypeScript type validation only</td></tr>
<tr><td><code>npm run build</code></td><td>🔨 Production build (main + renderer)</td></tr>
<tr><td><code>npm run build:main</code></td><td>🔨 Build Electron main process only</td></tr>
<tr><td><code>npm run build:renderer</code></td><td>🔨 Build React UI only (Vite)</td></tr>
<tr><td><code>npm start</code></td><td>🚀 Start packaged app</td></tr>
<tr><td><code>npm run package</code></td><td>📦 Create Windows installer (.exe)</td></tr>
</table>

### 🏗️ Project Architecture

<div align="center">

```
ai-workspace/
├── 📁 electron/              Electron main process
│   ├── main.ts              (~1300 lines) App lifecycle, IPC, sessions
│   └── preload.ts           Secure renderer bridge
│
├── 📁 src/
│   ├── renderer/            React UI (Vite)
│   │   ├── App.tsx          (~1400 lines) Complete UI + state
│   │   ├── styles.css       (~1400 lines) Themes + accessibility
│   │   └── assets/          SVG icons for all 8 providers
│   │
│   └── shared/
│       ├── types.ts         TypeScript interfaces
│       └── services.ts      Service registry
│
├── 📁 .github/
│   ├── workflows/           CI/CD automation
│   └── templates/           Issue & PR templates
│
└── 📄 Configuration
    ├── package.json         Dependencies & build config
    ├── tsconfig.json        TypeScript root config
    └── vite.config.ts       Vite + CSP settings
```

</div>

### 🔍 Key Files

| File | Purpose | Size |
|------|---------|------|
| `electron/main.ts` | Core lifecycle, IPC, sessions, broadcast adapters | 1,300 lines |
| `src/renderer/App.tsx` | React UI (onboarding, sidebar, broadcast, usage) | 1,400 lines |
| `src/renderer/styles.css` | Complete styling + 4 themes + accessibility | 1,400 lines |
| `src/shared/types.ts` | TypeScript interfaces for IPC contract | 200 lines |
| `src/shared/services.ts` | Service registry (8 providers metadata) | 100 lines |

## 📊 Usage Analytics

All usage metrics are stored **locally** in `~/.ai-workspace/usage.json`:

<details>
<summary><strong>View Sample Data</strong></summary>

```json
{
  "chatgpt": {
    "2026-08-07": { "openCount": 2, "switchCount": 1, "focusedTime": 1860 }
  },
  "claude": {
    "2026-08-07": { "openCount": 1, "switchCount": 0, "focusedTime": 300 }
  }
}
```

**Tracked Metrics:**
- `openCount` – Times the service was opened
- `switchCount` – Times you switched to this service  
- `focusedTime` – Seconds the window was active and visible

**NOT Tracked (Privacy First):**
- ❌ Token usage or API costs
- ❌ Conversation content
- ❌ External telemetry
- ❌ Network requests

</details>

## 🔐 Security & Privacy

### 🏠 Data Location
| Category | Storage | Cloud Sync | Telemetry |
|----------|---------|-----------|-----------|
| **Accounts** | `~/.ai-workspace/accounts.json` | ❌ None | ❌ Zero |
| **Usage** | `~/.ai-workspace/usage.json` | ❌ None | ❌ Zero |
| **Settings** | `~/.ai-workspace/config.json` | ❌ None | ❌ Zero |
| **Conversations** | Provider servers only | ✅ Provider manages | ✅ Provider only |

### 🔐 Authentication
- Each provider's login page loads in an isolated partition
- Credentials managed by provider (you control them)
- App never sees or stores passwords/tokens
- OAuth cookies stored in isolated persistent sessions

### 🚫 Permissions
- **Desktop files:** Only `~/.ai-workspace/` directory
- **Network:** HTTPS only, service-specific domains
- **Window:** Single-window model, no external processes
- **Clipboard:** Manual only (no programmatic access)

### ✅ Security Audit
- ✅ Electron 43.3.0 hardening verified
- ✅ Zero npm vulnerabilities (audit: `npm audit`)
- ✅ Navigation and popup guards effective
- ✅ Isolated sessions prevent cross-account leakage
- ✅ CSP enforced in production

📄 See [SECURITY.md](SECURITY.md) for detailed vulnerability disclosure policy.

---

## 🌍 Platform Support

| Platform | Status | Notes |
|----------|--------|-------|
| **Windows** | ✅ **Fully Supported** | Tested on Windows 10+, installer included |
| **macOS** | ⚠️ Possible | Requires dmg/zip build config (untested) |
| **Linux** | ⚠️ Possible | Requires AppImage/deb config (untested) |

Currently, **Windows packaging** is tested and included in releases. macOS/Linux contributions welcome!

---

## 📚 Documentation

<div align="center">

| Document | Purpose |
|----------|---------|
| **[README.md](README.md)** | Project overview & quick start |
| **[ARCHITECTURE.md](ARCHITECTURE.md)** | Technical design & deep dive |
| **[SECURITY.md](SECURITY.md)** | Security policy & vulnerability reporting |
| **[CONTRIBUTING.md](CONTRIBUTING.md)** | Development guidelines & commit conventions |
| **[CHANGELOG.md](CHANGELOG.md)** | Release notes & version history |
| **[LICENSE](LICENSE)** | MIT License |

</div>

## ❓ FAQ

<details>
<summary><strong>Q: Is my data shared with anyone?</strong></summary>
<strong>A:</strong> No. All data (accounts, usage, settings) is stored locally on your device. Zero telemetry, zero cloud sync.
</details>

<details>
<summary><strong>Q: Can I use multiple accounts with the same AI provider?</strong></summary>
<strong>A:</strong> Yes! Each account has its own isolated session. Switch between them instantly with zero cookie leakage.
</details>

<details>
<summary><strong>Q: Does the app work offline?</strong></summary>
<strong>A:</strong> No, you need internet to access the AI services. The app itself is offline-capable but won't load providers without connectivity.
</details>

<details>
<summary><strong>Q: Can I broadcast to just some providers?</strong></summary>
<strong>A:</strong> Yes! Select which accounts to include before sending. Only selected providers receive the prompt.
</details>

<details>
<summary><strong>Q: What if a provider updates but isn't detected?</strong></summary>
<strong>A:</strong> The app will report "Unsupported" rather than fail silently. See [CONTRIBUTING.md](CONTRIBUTING.md) to help update adapters.
</details>

<details>
<summary><strong>Q: How accurate is usage tracking?</strong></summary>
<strong>A:</strong> Tracks active time when (1) window is focused, (2) account is active, (3) provider is visible. Useful for trend analysis but approximate.
</details>

<details>
<summary><strong>Q: Can I add more AI providers?</strong></summary>
<strong>A:</strong> Absolutely! See [CONTRIBUTING.md](CONTRIBUTING.md). Process: register service → add auth domains → create broadcast adapter.
</details>

---

## 🤝 Contributing

Contributions are welcome! Here's how to get started:

1. **Fork** the repository
2. **Create** a feature branch: `git checkout -b feature/amazing-feature`
3. **Commit** changes: `git commit -m "Add amazing feature"`
4. **Push** to branch: `git push origin feature/amazing-feature`
5. **Open** a Pull Request

📖 See [CONTRIBUTING.md](CONTRIBUTING.md) for detailed guidelines on:
- Code style & TypeScript conventions
- Commit message format
- Testing requirements
- PR review process

---

## 🐛 Reporting Issues

Found a bug or have a feature request?

| Issue Type | Action |
|-----------|--------|
| **🔒 Security Issue** | Follow [SECURITY.md](SECURITY.md) for responsible disclosure |
| **🐛 Bug Report** | Use [Bug Report Template](https://github.com/BlockFrame/AI-workspace/issues/new?template=bug_report.md) |
| **✨ Feature Request** | Use [Feature Request Template](https://github.com/BlockFrame/AI-workspace/issues/new?template=feature_request.md) |

---

## 📜 License & Citation

This project is licensed under the **[MIT License](LICENSE)** – free for personal, commercial, and research use.

If you use AI Workspace in research or projects, please cite:

```bibtex
@software{ai_workspace_2026,
  title={AI Workspace: A Desktop Application for Multi-Provider AI Aggregation},
  author={BlockFrame},
  year={2026},
  url={https://github.com/BlockFrame/AI-workspace}
}
```

---

## ⚖️ Disclaimer

**AI Workspace is an independent project** and is **not affiliated** with OpenAI, Anthropic, Google, Mistral AI, or any other AI service provider. It provides a unified interface to access their public web applications.

---

<div align="center">

### 🌟 Enjoyed this project?
Leave a ⭐ on GitHub and share with friends!

[Star Repository](https://github.com/BlockFrame/AI-workspace) • [Report Issue](https://github.com/BlockFrame/AI-workspace/issues) • [View Releases](https://github.com/BlockFrame/AI-workspace/releases)

**Made with ❤️ by the AI Workspace community**

*Last updated: August 2026*

</div>
