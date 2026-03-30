import {hasLocale} from "next-intl";
import { headers } from "next/headers";
import {getRequestConfig} from "next-intl/server";
import {routing} from "@/i18n/routing";

function detectLocaleFromAcceptLanguage(headerValue: string | null) {
  if (!headerValue) {
    return routing.defaultLocale;
  }

  const candidates = headerValue
    .split(",")
    .map((part) => part.trim().split(";")[0]?.toLowerCase())
    .filter(Boolean) as string[];

  for (const candidate of candidates) {
    const short = candidate.split("-")[0];
    if (hasLocale(routing.locales, short)) {
      return short;
    }
  }

  return routing.defaultLocale;
}

export default getRequestConfig(async ({requestLocale}) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested)
    ? requested
    : detectLocaleFromAcceptLanguage((await headers()).get("accept-language"));

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});

