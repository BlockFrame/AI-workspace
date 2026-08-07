# GitHub Configuration

This directory contains GitHub-specific configuration for AI Workspace.

## Directory Structure

```
.github/
├── ISSUE_TEMPLATE/          # Issue templates for bug reports and feature requests
├── workflows/               # GitHub Actions CI/CD pipelines
└── pull_request_template.md # PR template
```

## Workflows

### `build.yml` – Continuous Integration

Runs on every push to `main`/`develop` and every pull request.

**Jobs:**
- **Build & Type Check:** Runs on Node 18.x and 20.x
  - Installs dependencies
  - TypeScript type checking
  - Full build (main + renderer)
  - npm audit for vulnerabilities

- **Security Audit:** Checks for critical npm vulnerabilities

- **Lint & Format:** Ensures code quality
  - TypeScript strict mode check

- **Package:** On main branch pushes only
  - Builds Windows installer
  - Uploads artifact

**Duration:** ~3–5 minutes

### `release.yml` – Automated Release

Triggers on git tags matching `v[0-9]+.[0-9]+.[0-9]+*` (e.g., `v1.0.0`, `v1.1.0-beta`).

**Steps:**
1. Checkout code with full history
2. Build and package application
3. Extract version from git tag
4. Create GitHub Release with:
   - Tag name and version
   - Changelog content
   - Windows installer and executable
5. Upload artifacts for 90 days

**Example tag creation:**
```bash
git tag v1.0.0
git push origin v1.0.0
# GitHub Actions automatically builds and releases
```

## Issue Templates

### Bug Report Template
- Captures environment (OS, Node, npm version)
- Steps to reproduce
- Expected vs. actual behavior
- Console/error output
- Screenshots/videos
- Validation checklist

**Location:** `.github/ISSUE_TEMPLATE/bug_report.md`

### Feature Request Template
- Problem statement
- Proposed solution
- Alternatives considered
- Priority level
- Optional: mockups or examples

**Location:** `.github/ISSUE_TEMPLATE/feature_request.md`

## Pull Request Template

Guides contributors through:
- Clear description and linked issues
- Type of change (bug fix, feature, breaking, docs)
- Testing performed
- Checklist (TypeScript, build, tests, documentation)
- Screenshots/videos (if UI changes)
- Breaking changes and migration
- Dependency changes

**Location:** `.github/pull_request_template.md`

## Best Practices

### Using Templates

1. **Bug reports:** Click "New Issue" → Select "Bug Report"
   - Fill out all fields
   - Include reproduction steps and console output

2. **Feature requests:** Click "New Issue" → Select "Feature Request"
   - Describe the problem and proposed solution
   - Add use cases

3. **Pull requests:** Template auto-fills when creating a PR
   - Fill out all checkboxes
   - Link related issues

### Workflow Badges

Display CI/CD status in README:

```markdown
[![Build & Test](https://github.com/blockframe/ai-workspace/actions/workflows/build.yml/badge.svg?branch=main)](https://github.com/blockframe/ai-workspace/actions/workflows/build.yml)
```

### Branch Protection Rules (Recommended)

On main branch, enable:
- ✅ Require status checks to pass (build.yml)
- ✅ Require code reviews (1 approval minimum)
- ✅ Require branches to be up-to-date
- ✅ Dismiss stale reviews when new commits pushed
- ✅ Require commit signature verification (optional)

---

**Maintained by:** blockframe team
**Last updated:** December 2024
