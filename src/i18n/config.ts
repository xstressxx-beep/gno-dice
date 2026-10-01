// Langues du site. Pour en ajouter une : créer messages/<code>.json (copie
// traduite de messages/en.json) puis ajouter son code et son nom ci-dessous.
export const LOCALES = {
  en: "English",
  zh: "中文",
  es: "Español",
  fr: "Français",
} as const;

export type Locale = keyof typeof LOCALES;

/** Langue par défaut, et de secours si celle du navigateur n'est pas disponible. */
export const DEFAULT_LOCALE: Locale = "en";

/** Cookie qui retient la langue choisie dans le sélecteur. */
export const LOCALE_COOKIE = "NEXT_LOCALE";

export function isLocale(value: string | undefined): value is Locale {
  return !!value && Object.hasOwn(LOCALES, value);
}

/** Choisit la langue à partir de l'en-tête Accept-Language du navigateur (ex. "zh-CN,zh;q=0.9,en;q=0.8"). */
export function matchLocale(acceptLanguage: string | null): Locale {
  const wanted = (acceptLanguage ?? "")
    .split(",")
    .map((part) => {
      const [tag, q] = part.trim().split(";q=");
      return { lang: tag.toLowerCase().split("-")[0], q: q ? Number(q) : 1 };
    })
    .sort((a, b) => b.q - a.q);
  return wanted.find((w) => isLocale(w.lang))?.lang as Locale | undefined ?? DEFAULT_LOCALE;
}
