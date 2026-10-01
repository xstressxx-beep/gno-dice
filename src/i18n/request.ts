import { cookies, headers } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import { DEFAULT_LOCALE, isLocale, LOCALE_COOKIE, matchLocale } from "./config";

// Langue de chaque visite : celle choisie dans le sélecteur (cookie), sinon
// celle du navigateur, sinon l'anglais. Les textes sont dans messages/<langue>.json.
export default getRequestConfig(async () => {
  const chosen = (await cookies()).get(LOCALE_COOKIE)?.value;
  const locale = isLocale(chosen) ? chosen : matchLocale((await headers()).get("accept-language"));
  const messages = (await import(`../../messages/${locale}.json`)).default;
  // Une clé absente d'une traduction s'affiche en anglais plutôt que vide.
  const fallback = locale === DEFAULT_LOCALE ? {} : (await import(`../../messages/${DEFAULT_LOCALE}.json`)).default;
  return { locale, messages: merge(fallback, messages) };
});

type Messages = { [key: string]: string | Messages };

function merge(base: Messages, over: Messages): Messages {
  const out: Messages = { ...base };
  for (const [k, v] of Object.entries(over)) {
    out[k] = typeof v === "object" && typeof base[k] === "object" ? merge(base[k] as Messages, v) : v;
  }
  return out;
}
