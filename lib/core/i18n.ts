export type Locale = "en" | "es" | "de";

export const SUPPORTED_LOCALES: Locale[] = ["en", "es", "de"];

const STRINGS: Record<Locale, Record<string, string>> = {
  en: {
    "answers.title": "Lane margins",
    "projects.title": "Project margins",
    "answers.empty": "No loads this week.",
    "projects.empty": "No projects this week.",
    "nav.upload": "Upload",
    "nav.answers": "Answers",
    "nav.briefs": "Briefs",
    "flag.title": "Flag a figure",
    "share.title": "Share this week",
    "week.label": "week of",
  },
  es: {
    "answers.title": "Márgenes por ruta",
    "projects.title": "Márgenes por proyecto",
    "answers.empty": "Sin cargas esta semana.",
    "projects.empty": "Sin proyectos esta semana.",
    "nav.upload": "Subir",
    "nav.answers": "Respuestas",
    "nav.briefs": "Informes",
    "flag.title": "Marcar una cifra",
    "share.title": "Compartir esta semana",
    "week.label": "semana del",
  },
  de: {
    "answers.title": "Spannen pro Route",
    "projects.title": "Spannen pro Projekt",
    "answers.empty": "Keine Ladungen diese Woche.",
    "projects.empty": "Keine Projekte diese Woche.",
    "nav.upload": "Hochladen",
    "nav.answers": "Antworten",
    "nav.briefs": "Berichte",
    "flag.title": "Wert melden",
    "share.title": "Diese Woche teilen",
    "week.label": "Woche vom",
  },
};

export function t(locale: string, key: string): string {
  const loc: Locale = SUPPORTED_LOCALES.includes(locale as Locale) ? (locale as Locale) : "en";
  return STRINGS[loc][key] ?? STRINGS.en[key] ?? key;
}

// Key inventory for the parity gate: every locale must carry the full
// English key set (missing keys fall back silently, which hides drift).
export function localeKeys(): Record<Locale, string[]> {
  return {
    en: Object.keys(STRINGS.en),
    es: Object.keys(STRINGS.es),
    de: Object.keys(STRINGS.de),
  };
}

export function formatMoney(n: number, locale: string, currency = "USD"): string {
  try {
    return new Intl.NumberFormat(locale, { style: "currency", currency }).format(n);
  } catch {
    return `$${n.toFixed(2)}`;
  }
}

export function formatDate(iso: string, locale: string): string {
  try {
    return new Intl.DateTimeFormat(locale, { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" }).format(
      new Date(`${iso}T00:00:00Z`),
    );
  } catch {
    return iso;
  }
}

export function isLocale(v: string): v is Locale {
  return SUPPORTED_LOCALES.includes(v as Locale);
}
