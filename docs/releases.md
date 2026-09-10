# Desktop releases

AI Workspace distributes native packages through
[GitHub Releases](https://github.com/BlockFrame/AI-workspace/releases). Release builds run on the
matching operating system rather than cross-compiling.

## Packages

| Platform | Package | Intended use |
| --- | --- | --- |
| Windows x64 | `.exe` | Interactive NSIS installer |
| macOS Apple Silicon | `mac-arm64.dmg` / `.zip` | M1 and newer Macs |
| macOS Intel | `mac-x64.dmg` / `.zip` | Intel Macs |
| Linux x64 | `.AppImage` | Portable distribution |
| Debian / Ubuntu x64 | `.deb` | System package installation |
| Linux x64 | `.tar.gz` | Manual or portable installation |

Every filename includes the application version, operating system, and architecture. A release also
contains `SHA256SUMS.txt`.

### Current beta validation

[`v1.1.0-beta.2`](https://github.com/BlockFrame/AI-workspace/releases/tag/v1.1.0-beta.2) is the
current cross-platform prerelease. Release workflow
[`34333898221`](https://github.com/BlockFrame/AI-workspace/actions/runs/34333898221) produced and
validated it:

| Check | Status |
| --- | --- |
| Windows, macOS, and Linux native CI builds | Passed for `beta.1` and `beta.2` |
| Packaged application startup on each native runner | Passed for `beta.2` |
| Release aggregation and SHA-256 manifest | Passed |
| Windows x64 `beta.1` checksum, isolated install, launch, and removal | Passed |
| Windows in-app update from `beta.1` to `beta.2` | Passed |
| macOS Intel and Apple Silicon manual installation | Awaiting real-device test |
| Linux DEB and tar.gz manual installation | Awaiting real-host test |

Starting with `beta.2`, the release workflow starts the packaged application on each native runner
before uploading assets. The macOS runner tests its native architecture, Linux tests the AppImage
under Xvfb, and Windows launches the unpacked executable with an isolated profile.

The Windows update-cycle test used an isolated `beta.1` installation and profile on the Beta
channel. It verified discovery of `1.1.0-beta.2`, user-initiated download, the
`READY TO INSTALL` state, explicit restart, state persistence, NSIS installation, and the updated
application reporting `AI Workspace 1.1.0-beta.2` with the Beta channel still selected.

Post-release testing found that `beta.2` can remain invisible on Windows when Electron does not emit
`ready-to-show`: the application and renderer processes remain healthy, but the main window has no
native handle. The `beta.3` candidate also shows the window after the renderer finishes loading and
forces an existing window visible when a second instance is launched. Its Windows CI smoke test now
requires a non-zero native window handle, so process liveness alone is no longer considered success.

## Verify a download

Run the command from the folder containing both the package and `SHA256SUMS.txt`.

### Windows PowerShell

```powershell
Get-FileHash .\AI-Workspace-*.exe -Algorithm SHA256
Get-Content .\SHA256SUMS.txt
```

Compare the printed hash with the matching entry in the manifest.

### macOS or Linux

```bash
shasum -a 256 AI-Workspace-*
cat SHA256SUMS.txt
```

## Publish a version

Only maintainers with write access can publish releases.

1. Start from a clean `main` branch with passing CI.
2. Choose a semantic version and update `version` in `package.json` and `package-lock.json`:

   ```bash
   npm version 1.1.0-beta.2 --no-git-tag-version
   ```

3. Move the relevant changelog entries from **Unreleased** into a dated version section.
4. Build locally:

   ```bash
   npm run build
   ```

5. Commit and push the version change to `main`.
6. Create and push the matching annotated tag:

   ```bash
   git tag -a v1.1.0-beta.2 -m "AI Workspace 1.1.0-beta.2"
   git push origin v1.1.0-beta.2
   ```

The tag must exactly match `v` plus the version in `package.json`. The workflow stops before
packaging if they differ.

The release workflow then:

1. validates the tag and package version;
2. builds Windows, macOS, and Linux packages in parallel;
3. fails if any expected platform artifact is missing;
4. downloads all artifacts into one publishing job;
5. generates SHA-256 checksums;
6. creates one GitHub Release with generated release notes.

A semantic prerelease tag such as `v1.2.0-beta.1` creates a GitHub prerelease.

### Publish the prepared `beta.2` candidate

The current topic branch contains the prepared `1.1.0-beta.2` candidate. From the repository root,
run these commands in order:

```bash
git status
git fetch origin
git log --oneline HEAD..origin/main
git tag --list v1.1.0-beta.2
git push origin HEAD:agents/product-backlog-restart-ai-aggregator
git push origin HEAD:main
git tag -a v1.1.0-beta.2 -m "AI Workspace 1.1.0-beta.2"
git push origin v1.1.0-beta.2
```

Before either push, `git status` must report a clean working tree,
`git log --oneline HEAD..origin/main` must produce no output, and
`git tag --list v1.1.0-beta.2` must produce no output. Stop if any of those checks differ. Pushing
the topic branch preserves the work branch, pushing the same commit to `main` publishes the source,
and pushing the annotated tag starts the release workflow.

After pushing, verify that all refs identify the same commit:

```bash
git fetch origin
git rev-parse HEAD
git rev-parse origin/main
git rev-parse origin/agents/product-backlog-restart-ai-aggregator
git rev-list -n 1 v1.1.0-beta.2
```

## Failure and rollback

- A failed platform build does not publish a partial GitHub Release.
- Fix the source or workflow, delete the unpublished remote tag, recreate it on the corrected
  commit, and push it again.
- Do not move a tag after a public release. Publish a new patch version instead.
- Keep a problematic release available only when users need its notes or assets; otherwise mark it
  as a prerelease and direct users to the last stable version.

The first `v1.1.0-beta.1` attempt exposed an important unsigned-build edge case: standard signing
environment variables must be omitted, not exported with empty values. The workflow therefore adds
Windows and macOS signing variables only when the corresponding repository secrets are present.

## Current trust boundary

The `1.1.0-beta.1` and `1.1.0-beta.2` packages are intentionally unsigned. Windows SmartScreen and
macOS Gatekeeper can show unknown-publisher warnings; testers must download only from the official
repository and verify `SHA256SUMS.txt`. The first `beta.1` to `beta.2` update cycle has passed, but
production signing remains a separate activation decision. The required setup is documented in the
[code-signing guide](./code-signing.md).

Packaged Windows and macOS builds, plus the Linux AppImage, expose a controlled updater in
**Settings > Updates**:

1. the app checks the official GitHub Release feed;
2. the user explicitly starts the download;
3. progress and the target version remain visible;
4. the user explicitly restarts to install after local state is persisted.

The `.deb` and `.tar.gz` packages direct users to GitHub Releases because Electron's Linux
self-update flow requires the AppImage runtime. Development builds never contact the update feed.

The default **Stable** channel ignores prereleases. Users who explicitly select **Beta** can also
receive versions tagged like `v1.2.0-beta.1`.
