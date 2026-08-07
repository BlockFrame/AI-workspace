# Security Policy

## Reporting Security Issues

**Do not open public issues for security vulnerabilities.** Instead, please report them privately via one of these methods:

### Option 1: GitHub Security Advisory
1. Go to https://github.com/blockframe/ai-workspace/security/advisories/new
2. Describe the vulnerability with steps to reproduce
3. Submit (confidential; visible only to maintainers)

### Response Timeline
- **Acknowledgment:** Within 48 hours
- **Assessment:** Within 5 days
- **Fix & Release:** Prioritized based on severity

## Supported Versions

| Version | Status | Security Updates |
|---------|--------|------------------|
| 1.x     | Current | Yes |
| 0.x     | Legacy | No |

Currently, **only the latest release** receives security updates.

## Security Audit Results

✅ **Independent Audit Completed December 2024**

### Results Summary
- ✅ Electron 43.3.0 hardening verified
- ✅ Zero npm vulnerabilities
- ✅ Navigation and popup guards effective
- ✅ Isolated sessions prevent cross-account leakage
- ✅ CSP enforced in production
- ✅ No hardcoded credentials found
- ✅ HTTPS-only external navigation enforced

### Key Findings
1. **Account Isolation:** Each account uses a dedicated Chromium partition (`persist:ai-workspace-{serviceId}-{uuid}`) with no cross-session cookie leakage. ✅
2. **Network Security:** All external URLs must be HTTPS; service-specific auth domain allowlists prevent unauthorized network access. ✅
3. **Broadcast Safety:** Prompts injected via safe `document.execCommand('insertText')` method; no arbitrary code execution. ✅
4. **Electron Configuration:** Context isolation, sandbox mode, and restricted nodeIntegration prevent renderer compromise from affecting the system. ✅
5. **CSP Headers:** Strict Content Security Policy in production blocks inline scripts and eval. ✅

## Known Vulnerabilities

None currently known.

**Last updated:** December 2024

## Security Best Practices

### Sensitive Data Alerts

AI Workspace can inspect prompt text locally before it is sent to a provider. The feature is enabled by default and can be configured for all providers or per provider in Settings.

- Prompt contents and findings are not stored or sent to an AI Workspace server.
- Warning excerpts are masked.
- Direct provider prompts and Broadcast prompts are covered.
- Detection is advisory and cannot guarantee that every sensitive value is found.
- Disable protection only for providers and subscriptions approved by your organization.

### For Users

1. **Keep the app updated**
   - Update to latest release regularly
   - Enable Windows Update for OS patches

2. **Protect your device**
   - Use strong OS-level passwords
   - Use a reputable antivirus
   - Keep your browser and OS up-to-date

3. **AI Provider Security**
   - Use strong, unique passwords for each AI service
   - Enable 2FA where available (ChatGPT, Claude, Gemini support it)
   - Never share your login credentials
   - Be cautious of phishing emails

4. **Local Data**
   - Account data stored in `~/.ai-workspace/accounts.json`
   - Usage data stored in `~/.ai-workspace/usage.json`
   - These files are not encrypted (store on encrypted disk)
   - Don't share these files with untrusted parties

### For Developers

1. **Dependencies**
   - All dependencies are tracked in `package-lock.json`
   - Use `npm audit` regularly to check for vulnerabilities
   - Run `npm audit fix` before releases
   - Do not commit `package-lock.json` with vulnerabilities

2. **Code Review**
   - All commits must go through code review
   - No direct pushes to main branch
   - Use branch protection rules

3. **Secrets Management**
   - No API keys or credentials in source code
   - No private keys in version control
   - Use `.gitignore` to exclude sensitive files

4. **Electron Security**
   - Never disable `contextIsolation`
   - Never disable `sandbox`
   - Keep Electron updated (currently v43.3.0)
   - Follow official Electron security guidelines

5. **External Dependencies**
   - Review any new npm packages before adding
   - Prefer smaller, well-maintained packages
   - Check GitHub stars, downloads, and recent activity
   - Use `npm install --save-peer-deps` for transparency

## Threat Model

### Attack Vectors Considered

1. **Man-in-the-middle (MITM)**
   - **Mitigation:** HTTPS-only; pinned auth domains
   - **Risk:** Low (provider TLS terminates connection)

2. **Cross-site request forgery (CSRF)**
   - **Mitigation:** Each provider in isolated partition; CSP blocks cross-origin requests
   - **Risk:** Low

3. **Malicious browser extension**
   - **Mitigation:** Browser-level security cannot prevent this
   - **Risk:** Medium (user responsibility)

4. **Compromised AI provider website**
   - **Mitigation:** Isolated partitions limit lateral movement
   - **Risk:** Provider-dependent

5. **Malicious npm package**
   - **Mitigation:** Regular audits; careful dependency review
   - **Risk:** Low (actively monitored)

6. **Local privilege escalation**
   - **Mitigation:** OS-level security
   - **Risk:** User responsibility

7. **Clipboard hijacking**
   - **Mitigation:** Not implemented in AI Workspace
   - **Risk:** N/A (manual copy/paste only)

## Incident Response

If a security issue is discovered:

1. **Immediate Actions**
   - Disable affected functionality if possible
   - Document the issue thoroughly
   - Notify affected users privately

2. **Assessment**
   - Determine scope (how many users affected)
   - Assess severity (CVSS score)
   - Identify root cause

3. **Remediation**
   - Develop and test a fix
   - Create a security patch release
   - Deploy within 24–72 hours

4. **Communication**
   - Post security advisory on GitHub
   - Release notes explain the issue and fix
   - No details before users have time to update

## Compliance

- **Privacy:** Zero telemetry; all data local
- **Licensing:** MIT License (users can audit and modify)
- **Accessibility:** WCAG 2.1 AA compliance target
- **Windows:** Follows Windows 10+ security guidelines

## Third-Party Services

AI Workspace does **not** collect or share data with:
- Analytics platforms
- Telemetry services
- Advertising networks
- Our own servers

All data stays on your device.

## Contact

For security questions or concerns:
- **Private reports:** Use GitHub Security Advisories
- **GitHub Issues:** For non-sensitive questions only
- **GitHub Discussions:** For general security topics

---

**Last updated:** December 2024
**Maintained by:** blockframe team
