# Contributing to AI Workspace

Thank you for your interest in contributing to AI Workspace! This document provides guidelines and instructions for contributing.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Making Changes](#making-changes)
- [Commit Guidelines](#commit-guidelines)
- [Pull Request Process](#pull-request-process)
- [Testing](#testing)
- [Adding New AI Providers](#adding-new-ai-providers)
- [Style Guide](#style-guide)
- [Reporting Bugs](#reporting-bugs)

## Code of Conduct

Be respectful and constructive in all interactions. We're building something together.

## Getting Started

1. **Fork the repository** on GitHub
2. **Clone your fork** locally:
   ```bash
   git clone https://github.com/YOUR_USERNAME/ai-workspace.git
   cd ai-workspace
   ```
3. **Add the upstream remote:**
   ```bash
   git remote add upstream https://github.com/blockframe/ai-workspace.git
   ```
4. **Create a branch** for your work:
   ```bash
   git checkout -b feature/your-feature-name
   ```

## Development Setup

### Prerequisites
- Node.js 18+ and npm 9+
- Windows 10+ (Linux/macOS possible but untested)
- Git

### Installation
```bash
cd ai-workspace
npm install
npm run dev
```

The app will launch with hot reload enabled.

### Project Structure Review

```
electron/main.ts              # Electron lifecycle, IPC, sessions, broadcasts
src/renderer/App.tsx          # React UI (onboarding, accounts, broadcast, settings)
src/shared/types.ts           # TypeScript interfaces
src/shared/services.ts        # Service registry
src/renderer/styles.css       # All styling + themes
```

Read the [README.md](README.md) "Project Structure" section for detailed file descriptions.

## Making Changes

### General Principles

1. **Keep it focused** – One feature or fix per pull request
2. **Maintain type safety** – All TypeScript must pass type checking (`npm run typecheck`)
3. **Follow existing patterns** – Look at similar code before writing new code
4. **Test your changes** – Run the app in dev mode and verify the feature works
5. **Update types if needed** – Changes affecting `types.ts` must be synchronized across main/renderer

### Common Tasks

#### Adding a Feature to the UI
1. Modify `src/renderer/App.tsx` (state, JSX, handlers)
2. Update `src/renderer/styles.css` (styling + dark theme)
3. If it involves new IPC, update `src/shared/types.ts` and `electron/main.ts`
4. Test in light and dark mode: `npm run dev`

#### Adding a New IPC Handler
1. Define the handler type in `src/shared/types.ts` under `DesktopApi`
2. Implement in `electron/main.ts` under the appropriate `ipcMain.handle()` call
3. Call from React via `window.desktopApi.methodName()`
4. Type checking will enforce correctness

#### Modifying Styles
1. Edit `src/renderer/styles.css`
2. Follow the existing structure: light theme defaults, dark theme overrides at bottom
3. Use CSS variables for colors (see `:root` and `.dark` sections)
4. Test in both light and dark mode

#### Fixing a Bug
1. Understand the bug by reproducing it in dev mode
2. Identify which process owns the bug (main vs. renderer)
3. Add a focused fix
4. Test the fix in packaged mode (`npm run package`) if it's significant

## Commit Guidelines

Use clear, descriptive commit messages following conventional commits:

```
type(scope): subject

body (optional)
```

### Types
- `feat:` – New feature
- `fix:` – Bug fix
- `refactor:` – Code restructuring (no behavior change)
- `style:` – Formatting, whitespace (no logic change)
- `docs:` – Documentation updates
- `test:` – Test additions/modifications
- `chore:` – Build, dependencies, tooling

### Examples
```
feat(broadcast): add Deep Research mode support for ChatGPT
fix(accounts): prevent session leakage between accounts
refactor(styles): extract theme colors to CSS variables
docs(readme): clarify installation steps
chore(deps): upgrade Electron to 43.3.0
```

### Commit Message Template

```
type(scope): brief subject (50 chars max)

Longer explanation of the change, why it's needed, and how it works.
Include any context or related issues.

Closes #123
Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>
```

## Pull Request Process

1. **Ensure your branch is up to date:**
   ```bash
   git fetch upstream
   git rebase upstream/main
   ```

2. **Verify your changes:**
   ```bash
   npm run typecheck
   npm run build
   ```

3. **Push your branch:**
   ```bash
   git push origin feature/your-feature-name
   ```

4. **Open a Pull Request** on GitHub with:
   - Clear title and description
   - Reference to any related issues (e.g., "Closes #42")
   - Screenshots/videos if UI changes
   - Testing steps

5. **Address review feedback** – Push additional commits to the same branch; they'll be included in the PR

6. **Squash and merge** – Maintainers will squash your commits when merging

## Testing

### Manual Testing Checklist
- [ ] App launches without errors
- [ ] Feature works in light mode
- [ ] Feature works in dark mode
- [ ] Feature works with keyboard navigation
- [ ] No TypeScript errors (`npm run typecheck`)
- [ ] No console errors in DevTools (`Ctrl+Shift+I`)

### Testing All Providers
When changing broadcast, account management, or provider registry:
- [ ] Test with ChatGPT account
- [ ] Test with Claude account
- [ ] Test with Perplexity account
- [ ] Test with Gemini account
- [ ] Test with Z.AI account
- [ ] Test with DeepSeek account
- [ ] Test with Kimi account
- [ ] Test with Mistral Vibe account

### Packaged Testing
For significant changes, also test the packaged version:
```bash
npm run package
# Find release/AI Workspace Setup.exe
# Run installer and test the feature
```

## Adding New AI Providers

To add a new AI provider (e.g., Llama Chat), follow these steps:

### Step 1: Update types.ts
In `src/shared/types.ts`, add the service ID to the `ServiceId` union:

```typescript
export type ServiceId = 'chatgpt' | 'claude' | 'perplexity' | 'gemini' | 'z-ai' | 'deepseek' | 'kimi' | 'mistral-vibe' | 'llama-chat';
```

### Step 2: Update services.ts
In `src/shared/services.ts`, add the service to the `SERVICES` array:

```typescript
{
  id: 'llama-chat',
  name: 'Llama Chat',
  homeUrl: 'https://llama.meta.com/chat',
  trustedHosts: ['llama.meta.com', 'auth.meta.com']
}
```

### Step 3: Update main.ts
In `electron/main.ts`:

**3a. Add to AUTH_HOSTS_BY_SERVICE:**
```typescript
const AUTH_HOSTS_BY_SERVICE: Record<ServiceId, string[]> = {
  // ... existing entries ...
  'llama-chat': ['llama.meta.com', 'auth.meta.com'],
};
```

**3b. Add a broadcast adapter in BROADCAST_ADAPTERS:**
```typescript
const BROADCAST_ADAPTERS: Record<ServiceId, BroadcastAdapter> = {
  // ... existing adapters ...
  'llama-chat': {
    selectors: {
      messageInputs: ['[data-testid="message-input"]', '.message-input', 'textarea'],
      sendButtons: ['[data-testid="send-button"]', 'button[aria-label*="Send"]'],
      researchToggles: [],
    },
    researchModeName: 'research',
  }
};
```

Look at existing adapters (ChatGPT, Claude, etc.) for examples. Test in the provider's web interface to find the correct selectors.

### Step 4: Add Icon
In `src/renderer/App.tsx`, add to the icon map:

```typescript
const ICON_MAP: Record<ServiceId, string> = {
  // ... existing icons ...
  'llama-chat': LlamaChatIcon,  // Import the icon from @lobehub/icons-static-svg
};
```

### Step 5: Test
1. Add a test account for the new provider
2. Verify it loads in the accounts list
3. Test switching to it
4. Test sending a prompt to it via broadcast
5. Run `npm run typecheck` and `npm run build`

### Step 6: Update Documentation
- Update [README.md](README.md) "Supported AI Services" section
- Update [CHANGELOG.md](CHANGELOG.md) with the new provider

## Style Guide

### TypeScript
- Use strict typing; avoid `any`
- Use enums/unions instead of magic strings
- Prefer `const` and `let` over `var`
- Use arrow functions for callbacks
- Keep functions focused and small

### React
- Use functional components with hooks
- Keep components small and single-responsibility
- Avoid deeply nested JSX
- Use descriptive variable names for state
- Memoize expensive calculations (`useMemo`, `useCallback`)

### Styles
- Use CSS variables for colors and spacing
- Follow BEM-like naming: `.component-section-element`
- Always include dark theme overrides
- Use flexbox/grid for layout (avoid floats)
- Test at 1024x768 and 1920x1080 resolutions

### Electron Main Process
- Use async/await instead of callbacks
- Handle IPC errors gracefully
- Keep handlers focused
- Log errors with context
- Avoid blocking operations

## Reporting Bugs

When reporting a bug, include:

1. **Environment:**
   - OS (Windows version)
   - Node/npm versions
   - AI Workspace version

2. **Steps to reproduce:**
   - Exact sequence of actions
   - Expected vs. actual behavior

3. **Logs/Screenshots:**
   - Browser console errors (`Ctrl+Shift+I`)
   - Screenshots of the issue

4. **Additional context:**
   - Does it happen with all providers or specific ones?
   - Did it work in a previous version?

Use the [Bug Report Template](.github/ISSUE_TEMPLATE/bug_report.md).

## Questions?

Open a GitHub Discussion or Issue if you need clarification. We're here to help!

---

Thank you for contributing! 🙌
