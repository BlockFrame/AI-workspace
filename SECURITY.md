# Security Policy

## Supported versions

AI Workspace is under active development. Security fixes are applied to the latest release and
the current `main` branch.

| Version | Supported |
| --- | :---: |
| Latest release | Yes |
| Current `main` | Yes |
| Older releases | Best effort |

## Report a vulnerability

Do **not** open a public issue containing exploit details, credentials, session data, or provider
cookies.

Use a private [GitHub Security Advisory](https://github.com/BlockFrame/AI-workspace/security/advisories/new)
and include:

- affected version or commit;
- operating system;
- reproduction steps;
- security impact;
- logs or screenshots with secrets removed;
- any suggested mitigation.

The maintainers will acknowledge the report when it is reviewed and coordinate disclosure based
on severity and available fixes. No fixed response or release deadline is guaranteed.

## Security architecture

The current model is documented in
[`docs/privacy-and-security.md`](./docs/privacy-and-security.md). Important controls include:

- sandboxed provider and renderer processes;
- `contextIsolation` with Node.js integration disabled;
- a narrow typed preload bridge;
- main-process validation of IPC payloads;
- persistent Chromium partition isolation per account;
- HTTPS and provider/authentication host allowlists;
- local sensitive-data warnings;
- no AI Workspace cloud or telemetry backend.

## Important limitations

- Provider websites are third-party content and change independently.
- Local JSON files can contain prompts, responses, and research data and are not encrypted by the
  application.
- Chromium partitions contain provider-managed session data.
- Sensitive-data detection is advisory and can miss content.
- GEO automation must remain supervised.
- Google OAuth can reject embedded user agents; AI Workspace does not import external cookies or
  weaken provider controls.

Use operating-system disk encryption and protect the local user account.

## Dependency reports

Dependency advisories without a demonstrated impact are still useful, but reports should identify
whether the vulnerable code path is reachable in this Electron application. CI runs:

```bash
npm audit --audit-level=high
```

## Safe harbor

Good-faith research that avoids privacy violations, service disruption, provider-account abuse,
and data destruction is welcome. Stop testing and report privately if you encounter credentials or
personal data that do not belong to you.
