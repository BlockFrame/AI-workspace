# Changelog

All notable changes to AI Workspace are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Local sensitive-data detection for direct and Broadcast prompts
- Pre-send warnings with masked findings for common PII, financial information, credentials, and confidential-business markers
- Global and per-provider alert controls in Settings, enabled by default

## [1.0.0] - 2024-12-07

### Initial Release ✨

A desktop workspace for seamlessly navigating, managing, and comparing multiple AI services.

#### Added
- **Multi-AI Integration**
  - Support for 8 AI services: ChatGPT, Claude, Perplexity, Gemini, Z.AI, DeepSeek, Kimi, Mistral Vibe
  - Independent account management per service
  - Persistent isolated sessions (no cookie leakage)
  - Instant switching between accounts and providers

- **Broadcast Feature**
  - Send the same prompt to multiple AI services simultaneously
  - Standard and Deep Research modes (per-provider support)
  - Concurrent execution with result aggregation
  - Safe prompt injection via native browser APIs

- **Local Usage Analytics**
  - Track AI service usage over 7-day and 30-day periods
  - Metrics: open count, switch count, focused time
  - Reset analytics on demand
  - 100% local storage (no cloud sync)

- **Security & Privacy**
  - Electron 43.3.0 hardening (context isolation, sandbox)
  - HTTPS-only external navigation
  - Service-specific auth domain allowlists
  - Zero external telemetry
  - Independent security audit verified

- **Accessibility**
  - Light/Dark/High-Contrast theme modes
  - Text scaling (80%–200%)
  - Reduced motion support
  - Full keyboard navigation
  - Focus trapping in dialogs
  - WCAG 2.1 compliance target

- **Localization**
  - Complete English UI
  - Professional terminology
  - Consistent across all components

- **User Experience**
  - Guided three-step onboarding
  - Comprehensive settings dashboard
  - Tabs: Preferences, Usage, Reset Options
  - Broadcast composer with mode selection
  - Official provider brand icons
  - Responsive layout (1024x768 to 4K)

- **Official Provider Icons**
  - ChatGPT, Claude, Perplexity, Gemini
  - Z.AI, DeepSeek, Kimi, Mistral Vibe
  - Source: @lobehub/icons-static-svg

#### Technical
- **Technology Stack**
  - Electron 43.3.0
  - React 19 + TypeScript 5.8
  - Vite build system
  - Electron Builder packaging

- **Architecture**
  - Preload bridge for secure IPC
  - Isolated Chromium partitions per account
  - WebContentsView lifecycle management
  - Broadcast adapters with CSS selectors

- **Platform Support**
  - Windows 10+ (fully tested)
  - macOS/Linux (possible, untested)

#### Security Audit
✅ Passed independent security review
✅ Zero npm vulnerabilities
✅ No hardcoded credentials
✅ HTTPS-enforced external navigation
✅ Cross-account session isolation verified

#### Known Limitations
- Real token/cost tracking unavailable (no billing API access)
- macOS/Linux packaging untested
- Real authentication flows not tested (mock accounts used in testing)
- DeepSeek may return ACCESS DENIED in some geographic/network contexts

---

## Versioning Strategy

- **Major (X.0.0):** Breaking changes, major features, security updates
- **Minor (1.X.0):** New features, new providers, non-breaking enhancements
- **Patch (1.0.X):** Bug fixes, security patches, dependency updates

---

## Release Process

1. Update version in `package.json`
2. Update `CHANGELOG.md` with changes
3. Commit with message: `chore(release): bump version to X.Y.Z`
4. Tag: `git tag vX.Y.Z`
5. Push: `git push origin main --tags`
6. GitHub Actions builds and creates release

---

## Planned Features (Roadmap)

### v1.1.0 (Next Minor)
- [ ] macOS packaging
- [ ] Linux packaging
- [ ] Context history/conversation memory
- [ ] Custom provider settings per account
- [ ] Export usage analytics to CSV

### v1.2.0
- [ ] More AI providers (Groq, Replicate, Together AI)
- [ ] Provider-specific keyboard shortcuts
- [ ] Broadcast result comparison UI (side-by-side)
- [ ] Scheduled prompts/automation

### v2.0.0 (Future)
- [ ] Token cost estimation (integration with provider APIs)
- [ ] Cloud sync (opt-in, encrypted)
- [ ] Team workspaces
- [ ] Prompt library and templates
- [ ] Custom analytics dashboards

---

## Notes for Contributors

- See [CONTRIBUTING.md](CONTRIBUTING.md) for detailed contribution guidelines
- See [SECURITY.md](SECURITY.md) for security reporting
- Issues labeled `good first issue` are great starting points
- Discussions tab for feature ideas and questions

---

## Support

- 📖 **Documentation:** See [README.md](README.md)
- 🐛 **Report Bugs:** Use [Bug Report Template](.github/ISSUE_TEMPLATE/bug_report.md)
- 💡 **Request Features:** Use [Feature Request Template](.github/ISSUE_TEMPLATE/feature_request.md)
- 🔒 **Security:** See [SECURITY.md](SECURITY.md)

---

**Maintained by:** blockframe
**License:** MIT
**Last updated:** December 2024
