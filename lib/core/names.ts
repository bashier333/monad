export function normalizeName(raw: string, aliases: Map<string, string>): string {
  const key = normalizeText(raw);
  return aliases.get(key) ?? key;
}

const COMBINING = /[̀-ͯ]/g;
const INVISIBLE = /[​-‏‪-‮⁠-⁤﻿]/g;

export function normalizeText(raw: string): string {
  const nfkd = raw.normalize("NFKD");
  const noMarks = nfkd.replace(COMBINING, "");
  const noControls = noMarks.replace(INVISIBLE, "");
  const noSurrogates = [...noControls].filter((ch) => {
    const cp = ch.codePointAt(0) ?? 0;
    return cp < 0xd800 || cp > 0xdfff;
  }).join("");
  return noSurrogates.trim().toUpperCase().replace(/[^A-Z0-9 ]/g, "").replace(/\s+/g, " ").trim();
}

export function stripForMatch(raw: string): string {
  return normalizeText(raw);
}
