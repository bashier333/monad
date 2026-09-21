// Single source of truth for the running app version.
//
// Rule: bump ONLY via `npm run release <x.y.z>`. That script rewrites this
// file, package.json, the changelog page ENTRIES, and CHANGELOG.md together,
// so the website, the app, the exe feed, and the docs can never disagree.
// Everything user-visible reads APP_VERSION — never a hardcoded string.
export const APP_VERSION = "1.3.0";
