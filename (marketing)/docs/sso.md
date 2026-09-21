# SSO hooks (P-266)

Today: Google OAuth only. Enterprise SSO (SAML/OIDC) lands when a paying org requires it —
not before. Hooks already in place: Auth.js provider model (add provider in `lib/auth.ts`),
role mapping on first login (default VIEWER, invite upgrades), org scoping unchanged.
Do not build a provider picker UI until then.
