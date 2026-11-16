# H1 - PRD v2.0 authentication

Scope: PRD.docx v2.0 US4 and BR-16 through BR-20. US4 is authoritative for
MFA cancellation: expiry or three incorrect codes cancels the login; there is
no automatic resend. US8 account-management expansion is a separate task.

## Configuration and rollout

Keep the existing Backend/.env. Merge the configuration names from
Backend/.env.auth.example into it, using real SMTP credentials locally. Do not
commit credentials. SMTP must support STARTTLS or implicit TLS with a valid
certificate. For Gmail, use the provider's supported SMTP authentication
credentials, not a public/demo password. The application does not implement
SMTP OAuth. No OTP bypass, hard-coded OTP, console mailbox, or frontend secret
is provided.

- ADMIN_EMAIL is the seed account's email AND the login identifier. It must
  match the existing account; changing it does not rename an existing user.
- ADMIN_USERNAME remains only for legacy seed identity compatibility. The
  login endpoint no longer accepts username-only requests.
- ADMIN_PUBLIC_URL is the trusted Admin frontend URL used in reset links. Use
  HTTPS outside loopback. It is not inferred from untrusted Host headers.
- ADMIN_LOCK_SECONDS defaults to 900 (allowed: 60-86400).
- ADMIN_RESET_TTL_SECONDS defaults to 1800 (allowed: 300-3600).
- SMTP_HOST, SMTP_FROM, SMTP_USERNAME, SMTP_PASSWORD, SMTP_PORT and
  SMTP_SECURITY configure email. SMTP_SECURITY is starttls (default, port587)
  or ssl (default port465).
- Set ADMIN_COOKIE_SECURE=true when serving over HTTPS.

Restart the backend after configuring. Startup applies the additive auth
schema in app/modules/auth/schema.sql after the existing shared schema. It
creates auth_account_security, auth_challenges and auth_session_assurance;
it does not alter users, shared schema files, or existing passwords. The DB
account needs CREATE privileges for this rollout. Existing pre-upgrade sessions
have no new assurance and require fresh login. Do not run old and new backend
versions concurrently during deployment. These tables must be included in
database backups; keep the auth migration when coordinating with Nhat.

Missing/unavailable SMTP does NOT disable Super Admin MFA: login returns503
without creating a session. Reset requests keep the same generic response for
missing accounts, inactive accounts and delivery failures. Without configured
SMTP, real emailed OTP/reset acceptance is still pending, not verified.

## API and state transitions

- POST /auth/login: {email,password}. Email is trimmed/lowercased; password is
  preserved. Ordinary active Admins receive the existing HttpOnly session.
  Super Admin receives {mfa_required:true,challenge_token,expires_in:300}
  without a new authenticated session. Only a hashed challenge and proof are
  stored. Pending MFA does not reset the password failure counter.
- POST /auth/mfa/verify: {challenge_token,code}. Six ASCII digits, five-minute
  lifetime, at most three wrong codes. A successful, single-use verification
  creates the session, resets the counter and records login_success atomically.
  A newer login replaces the previous pending challenge.
- POST /auth/forgot-password: {email}. Always returns the generic delivery
  message for validly formatted emails, subject to request throttling. Email
  delivery executes after the response; repeated reset email is suppressed
  for sixty seconds per account. A newer issued link replaces the older one.
- POST /auth/reset-password: {token,password,confirmation}. Password is at
  least eight characters, contains letters and digits and fits bcrypt's
  72-UTF8-byte limit. The hashed, expiring link is single-use. Password update,
  all account session/challenge revocations, counter reset and password_reset
  audit commit together. Returns204 and does not authenticate the browser.
- GET /admin/me/permissions, POST /auth/refresh and POST /auth/logout retain
  their existing interface. Refresh rotates the token and its assurance in one
  transaction. Logout clears the cookie and rejects further protected access.

Five consecutive password failures lock the ACCOUNT for fifteen minutes,
independent of client IP and persisted across restarts. The fifth failure and
attempts during a lock return423 with the UTC retry time. A lock produces one
account_locked audit record. On expiry, a new failure sequence starts; only a
completed login resets it. Invalid credentials return401. Deactivated/pending
accounts return403. Missing/expired/consumed MFA returns401; invalid reset links
return400; bad input422; IP/email throttling429; unavailable MFA email503.

The existing request-origin guard, live permission checks, no-store responses
and protected cookies remain enabled. The additional in-memory abuse limiter
allows ten requests per endpoint/IP/hashed identity and sixty auth requests per
IP per minute. It is supplementary, single-process protection; deployment with
multiple workers needs a shared rate limiter or an upstream trusted gateway.
Account lockout and one-use challenge consumption are transactional MySQL state
and work across processes. Requests use the direct client IP, not arbitrary
X-Forwarded-For headers.

Session/challenge fingerprints bind them to the current password, role and
account status. A non-MFA session cannot become a Super Admin session after
promotion. Pending challenges become invalid after a password or role change.
Existing management endpoints still revoke sessions when changing role/status.
Expired challenges and orphan assurance rows are cleaned up on subsequent
issuance/startup. Audit payloads contain no password, OTP or raw link token.

## Frontend

The existing login page now uses email. It includes the OTP stage and countdown,
forgot-password request form, reset-password route, confirmation input and
terminal OTP error handling. No dashboard state is loaded before MFA succeeds.
Reset/activation query tokens are removed from browser history after capture
in component memory; referrers are disabled. Reloading the scrubbed link page
requires reopening the email link. Normal logout routing remains unchanged.

## Verification

Local isolated MySQL verification passed 86 assertions for this scope. Python
compilation, TypeScript checks and the frontend production build also passed.
The disposable database was removed; production DB/schema, passwords and real
email were not changed by verification. Local JSON reports are not required for
deployment. Real SMTP delivery and browser acceptance against the configured
server are separate rollout checks; do not mark them passed using the captured
test mailbox. Earlier local-assignment checks are not full PRD-v2 acceptance.
