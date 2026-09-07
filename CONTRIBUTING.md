# Contributing

Thanks for helping improve AI Workspace. The project combines a React interface, a privileged
Electron main process, and frequently changing third-party provider websites. Small, verified
changes are easier to review and maintain.

## Development setup

### Requirements

- Node.js 20 or 22
- npm
- Git
- A supported desktop operating system

```bash
git clone https://github.com/BlockFrame/AI-workspace.git
cd AI-workspace
npm ci
npm run dev
```

## Before making changes

Read:

- [Architecture](./docs/architecture.md)
- [Workflow guide](./docs/workflows.md)
- [Privacy and security model](./docs/privacy-and-security.md)

Keep account isolation, user consent, and the distinction between Broadcast, Research Lab, and GEO
intact.

## Repository conventions

- TypeScript remains strict; do not use `any` to bypass a contract.
- Renderer code cannot access Node.js APIs.
- Every new renderer-to-main capability must be represented in `DesktopApi`.
- Validate IPC input again in the main process.
- Reuse existing stores, adapters, and normalization helpers.
- Surface errors; do not return success-shaped fallbacks.
- Keep light, dark, high-contrast, text-size, and responsive behavior aligned.
- Update documentation when behavior or data handling changes.

## Common change paths

### Renderer-only change

1. Update the relevant component under `src/renderer/`.
2. Add light and dark styles in `src/renderer/styles.css`.
3. Test expanded/collapsed navigation and a compact viewport.
4. Test standard and extra-large text.

### IPC change

1. Add or update types in `src/shared/types.ts`.
2. Implement the preload method/event in `electron/preload.ts`.
3. Validate and handle it in `electron/main.ts`.
4. Use the typed method from the renderer.
5. Verify shutdown and error behavior if the operation writes data.

### Research or GEO change

1. Start with `src/shared/research-types.ts` or `src/shared/geo-types.ts`.
2. Update the matching store under `electron/`.
3. Update IPC and progress events.
4. Update the workspace component.
5. Test recovery, retry, manual edits, and app close.

### Provider adapter change

Provider integrations are registered in:

- `src/shared/services.ts`
- `electron/main.ts` (`AUTH_HOSTS_BY_SERVICE` and `BROADCAST_ADAPTERS`)
- `src/renderer/App.tsx` (provider icon mapping)

Before adding or changing a provider:

1. verify a stable public HTTPS web application;
2. document authentication hosts and embedded-login limitations;
3. use narrow composer, send, response, and streaming selectors;
4. preserve safe text insertion and explicit send behavior;
5. test Standard and Deep Research separately;
6. test GEO snapshot/stability behavior with a small supervised batch;
7. update README and workflow documentation.

Never broaden host allowlists or disable web security to make a provider work.

## Validation

Run the smallest relevant checks while developing, then run the full build before opening a pull
request:

```bash
npm run typecheck
npm run build
git diff --check
```

For packaging changes:

```bash
npm run package:win
npm run package:mac
npm run package:linux
```

Only the package for the current operating system can be fully exercised locally. Use the GitHub
Actions matrix for the other platforms.

### Manual checklist

- [ ] App starts without main-process or renderer errors.
- [ ] Changed workflow succeeds and its failure path is visible.
- [ ] Light and dark themes remain readable.
- [ ] Compact and large viewports do not clip controls.
- [ ] Keyboard navigation and focus remain usable.
- [ ] Drafts and active work are protected on close.
- [ ] Provider changes were tested with authenticated accounts.
- [ ] Privacy/security documentation still describes the behavior accurately.

## Commits

The repository uses short conventional-style subjects:

```text
feat(research): add linked optimization rounds
fix(geo): clear stale citations after manual edits
docs: modernize architecture and workflow guides
chore(ci): package Linux and macOS artifacts
```

Keep unrelated changes in separate commits. Do not include generated `dist/`, `release/`, local
user data, or credentials.

## Pull requests

A pull request should include:

- the user problem and chosen behavior;
- important architectural or privacy decisions;
- validation commands and manual scenarios;
- screenshots for visible UI changes;
- provider/account conditions required to reproduce;
- known limitations.

Use [the pull request template](./.github/pull_request_template.md).

## Security issues

Do not open a public issue for a suspected vulnerability. Follow [SECURITY.md](./SECURITY.md).
