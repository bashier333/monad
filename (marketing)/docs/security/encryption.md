# Encryption (B-093) — verify, don't assume

- [ ] TLS everywhere: hosting terminates TLS (verify HSTS on staging; no http:// listeners).
- [ ] Postgres at rest: provider volume encryption ON (screenshot in this folder before pilot 1).
- [ ] Object storage SSE: bucket default encryption ON (verify with provider CLI).
- [ ] Local dev `var/uploads`: gitignored, never committed; wipe before sharing machines.
- [ ] Secrets: env/store only (CI scan enforces); AUTH_SECRET ≥256 bits.
- [ ] Backups encrypted with the same provider defaults (verify restore path decrypts).
