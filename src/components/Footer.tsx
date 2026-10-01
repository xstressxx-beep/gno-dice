import Link from "next/link";
import { useTranslations } from "next-intl";
import { config } from "@/lib/config";

export function Footer() {
  const t = useTranslations("footer");
  const isTestnet = config.chainId !== "gnoland-1";
  return (
    <footer className="mt-auto border-t border-border text-sm text-haze">
      <div className="page-container flex flex-col gap-6 py-10 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-2">
          <p className="display-soft text-3xl leading-none text-chalk">gnodice</p>
          <p className="max-w-[48ch]">
            {t.rich("about", {
              link: (chunks) => (
                <a href={config.gnowebUrl} target="_blank" rel="noreferrer">
                  {chunks}
                </a>
              ),
            })}
            {isTestnet && ` ${t("testnet")}`} {t("responsible")}
          </p>
        </div>
        <nav aria-label={t("nav")} className="flex flex-wrap gap-x-6 gap-y-2">
          <a href="#comment-ca-marche">{t("how")}</a>
          {config.faucetUrl && (
            <a href={config.faucetUrl} target="_blank" rel="noreferrer">
              {t("faucet")}
            </a>
          )}
          <a href="https://adena.app" target="_blank" rel="noreferrer">
            {t("adena")}
          </a>
          <Link href="/admin">{t("admin")}</Link>
        </nav>
      </div>
    </footer>
  );
}
