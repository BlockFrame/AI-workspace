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
   npm version 1.1.0-beta.1 --no-git-tag-version
   ```

3. Move the relevant changelog entries from **Unreleased** into a dated version section.
4. Build locally:

   ```bash
   npm run build
   ```

5. Commit and push the version change to `main`.
6. Create and push the matching annotated tag:

   ```bash
   git tag -a v1.1.0-beta.1 -m "AI Workspace 1.1.0-beta.1"
   git push origin v1.1.0-beta.1
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

## Failure and rollback

- A failed platform build does not publish a partial GitHub Release.
- Fix the source or workflow, delete the unpublished remote tag, recreate it on the corrected
  commit, and push it again.
- Do not move a tag after a public release. Publish a new patch version instead.
- Keep a problematic release available only when users need its notes or assets; otherwise mark it
  as a prerelease and direct users to the last stable version.

## Current trust boundary

The `1.1.0-beta.1` packages are intentionally unsigned while the first end-to-end release and update
cycle is validated. Windows SmartScreen and macOS Gatekeeper can show unknown-publisher warnings;
testers must download only from the official repository and verify `SHA256SUMS.txt`. Signing remains
deferred until after `beta.1` can update successfully to `beta.2`. The required production setup is
already documented in the [code-signing guide](./code-signing.md).

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
