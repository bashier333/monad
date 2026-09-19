# Auth policy (S-037/S-041/S-042/S-043/S-044/S-045/S-718)

Provider: Auth.js (NextAuth v5) with database sessions (S-718 note: strategy is
`database`, implications — sessions are DB rows, revocation is a delete).

- Sessions are created only post-verification (S-041 note: magic-link redeemed or
  OAuth callback completed; no pre-login tokens exist).
- Idle timeout 24h (`updateAge`), absolute timeout 30d (`maxAge`), explicit in
  `lib/core/auth.ts` (S-042/S-043).
- No concurrent-session cap (S-044 decision: throttle, don't lock — same as
  passwords; users can sign out everywhere from settings).
- No session fixation (S-045 note: Auth.js rotates session tokens at sign-in;
  role/org evaluated per request server-side, so fixation buys nothing).
- Cookies: NextAuth secure defaults — `__Secure-` prefix + HttpOnly + SameSite
  Lax in production over https, host-only (no wildcard domain, S-035 note).
  Cookie payload is a session token only (~100 bytes, S-037 note).
- Login/logout logged to AccessLog without PII (S-048/S-057).
- Stale tokens rejected: sign-out deletes the DB row; org removal blocks all
  session use immediately (S-047/S-058 note).
