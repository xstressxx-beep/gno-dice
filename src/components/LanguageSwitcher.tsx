"use client";

// Sélecteur de langue de l'en-tête : la langue choisie est gardée dans un
// cookie (1 an), puis la page est rechargée côté serveur dans cette langue.

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Check, Languages } from "lucide-react";
import { LOCALE_COOKIE, LOCALES, type Locale } from "@/i18n/config";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

/** Retient la langue choisie pendant 1 an. */
function saveLocale(locale: Locale) {
  document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=31536000; samesite=lax`;
}

export function LanguageSwitcher() {
  const locale = useLocale();
  const t = useTranslations("language");
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function choose(next: Locale) {
    saveLocale(next);
    startTransition(() => router.refresh());
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={t("label")}
          disabled={pending}
          className="inline-flex h-10 items-center gap-1.5 rounded-full px-2.5 text-sm text-haze transition-colors hover:text-chalk disabled:opacity-60"
        >
          <Languages className="size-4" />
          <span className="uppercase">{locale}</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {(Object.entries(LOCALES) as [Locale, string][]).map(([code, name]) => (
          <DropdownMenuItem key={code} lang={code} onSelect={() => choose(code)}>
            <Check className={code === locale ? "" : "invisible"} />
            {name}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
