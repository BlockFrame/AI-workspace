# Changelog

Notable changes to AI Workspace are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

## [1.1.0-beta.3] - 2026-09-10

### Fixed

- The Windows application now becomes visible after its renderer loads even when Electron's
  `ready-to-show` event is not emitted.
- Opening the application a second time now restores and shows an existing hidden window.

### Changed

- The Windows release smoke test now requires a real visible application window instead of only a
  live process.

## [1.1.0-beta.2] - 2026-09-09

### Fixed

- Unsigned macOS release builds no longer receive an empty certificate path.
- Release jobs now use the Node.js version required by Electron.

### Added

- Native-runner startup smoke tests for packaged Windows, macOS, and Linux applications.

## [1.1.0-beta.1] - 2026-09-09

### Added

- Native AI Workspace application icons for Windows, macOS, and Linux packages.
- Windows, macOS, and Linux packaging through Electron Builder and GitHub Actions.
- Per-account provider settings, reusable context, prompt history, and local schedules.
- Prompt template library with categories, search, variables, preview, and explicit application.
- Local usage CSV export with spreadsheet-formula protection.
- Broadcast delivery comparison and provider navigation shortcuts.
- Research Lab projects with source responses, notes, editable optimization prompts, optimized
  answers, and linked follow-up rounds.
- Extensible Use Cases library with GEO as the first specialized workflow.
- GEO CSV/TXT import, sequential supervised batches, response/citation capture, review states,
  retry, pause, and manual correction.
- Persistent application zoom shortcuts with responsive reflow.
- Consistent browser identity for provider views and OAuth popups, plus Perplexity email fallback
  guidance when Google rejects an embedded flow.
- Collapsible, responsive sidebar and compact connected-account navigation.
- Updated architecture, workflow, privacy, security, and contribution documentation.
- Deterministic GitHub Release publishing with version validation, native platform artifacts, and
  SHA-256 checksums.
- Consent-based desktop update checks, downloads, restart installation, and stable/beta channels.
- Secret-driven Windows signing and macOS Developer ID signing/notarization release paths.

### Changed

- Application navigation now uses a neutral theme-aware visual system.
- GEO corrections remove citations and URLs from the previous automatic capture.
- Research and GEO participate in close/save confirmation.
- Provider views used by active Broadcast or GEO work are protected from warm-cache eviction.
- Product scope is explicitly local-first; cloud sync, team workspaces, custom dashboards, and
  speculative token/cost estimates are not active commitments.

### Fixed

- Draft loss while switching Research projects, rounds, providers, or closing the app.
- Duplicate GEO starts and cancellation affecting unrelated studies.
- Stale GEO capture metadata after retry or manual replacement.
- GEO response capture accepting pre-existing provider messages.
- Prompt text left in a provider composer when delivery could not continue.
- Sidebar button text and icon overflow with large text and compact layouts.

## [1.0.0] - 2024-12-07

### Added

- Electron desktop shell with React and TypeScript.
- Eight provider registrations: ChatGPT, Claude, Perplexity, Gemini, Z.AI, DeepSeek, Kimi, and
  Mistral.
- Isolated persistent Chromium partitions per account.
- Provider switching, initial Broadcast support, local usage tracking, and settings.
- Sandboxed renderer, context-isolated preload, and provider navigation guards.

[Unreleased]: https://github.com/BlockFrame/AI-workspace/compare/v1.1.0-beta.3...HEAD
[1.1.0-beta.3]: https://github.com/BlockFrame/AI-workspace/compare/v1.1.0-beta.2...v1.1.0-beta.3
[1.1.0-beta.2]: https://github.com/BlockFrame/AI-workspace/compare/v1.1.0-beta.1...v1.1.0-beta.2
[1.1.0-beta.1]: https://github.com/BlockFrame/AI-workspace/compare/v1.0.0...v1.1.0-beta.1
[1.0.0]: https://github.com/BlockFrame/AI-workspace/releases/tag/v1.0.0
