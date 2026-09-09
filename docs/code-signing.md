# Code signing

AI Workspace can build unsigned packages without credentials. Public production releases should
configure signing because it establishes publisher identity, reduces operating-system warnings, and
is required for reliable macOS updates.

Never commit certificates, private keys, passwords, or Apple credentials. Store them as GitHub
Actions repository or environment secrets.

## Windows

Obtain a code-signing certificate suitable for public Windows desktop software. Export it as a
password-protected `.pfx` file and encode the file as Base64.

Configure:

| GitHub Secret | Value |
| --- | --- |
| `WIN_CSC_LINK` | Base64-encoded `.pfx`, secure URL, or certificate file content supported by Electron Builder |
| `WIN_CSC_KEY_PASSWORD` | Password protecting the `.pfx` |

Electron Builder discovers these variables during the Windows matrix build and signs the unpacked
application and NSIS installer. Keep timestamping enabled so signatures remain valid after the
certificate expires.

After a release, inspect the downloaded installer:

```powershell
Get-AuthenticodeSignature .\AI-Workspace-*-win-x64.exe | Format-List
```

The status must be `Valid`, and the signer must match the expected publisher.

## macOS

Join the Apple Developer Program and create a **Developer ID Application** certificate. Export it
with its private key as a password-protected `.p12`, then encode it as Base64.

Configure:

| GitHub Secret | Value |
| --- | --- |
| `MAC_CSC_LINK` | Base64-encoded Developer ID Application `.p12` |
| `MAC_CSC_KEY_PASSWORD` | Password protecting the `.p12` |
| `APPLE_ID` | Apple ID used for notarization |
| `APPLE_APP_SPECIFIC_PASSWORD` | App-specific password for that Apple ID |
| `APPLE_TEAM_ID` | Apple Developer Team ID |

When all credentials are present, Electron Builder signs the app and submits it through Apple's
notary service before creating the DMG and ZIP.

After a release, validate both signing and notarization on macOS:

```bash
codesign --verify --deep --strict --verbose=2 "/Applications/AI Workspace.app"
spctl --assess --type execute --verbose=2 "/Applications/AI Workspace.app"
```

## Secret rotation

1. Add the replacement certificate or credential before revoking the old one.
2. Publish a private or prerelease candidate and verify its signature.
3. Replace the production secret values.
4. Revoke the superseded credential.
5. Publish a new version; never replace assets attached to an existing public tag.

## Release policy

- Unsigned builds are suitable for internal testing only.
- Stable public releases should be signed on Windows and signed plus notarized on macOS.
- Beta releases should use the same signing identities as stable releases.
- A signing or notarization failure must fail the platform build and prevent the aggregate release
  job from publishing partial assets.
