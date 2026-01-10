import {
  isTosUrl,
  isTosText,
  isPrivacyText,
  FOOTER_SELECTORS,
  TOS_OG_PATTERNS,
  TOS_JSONLD_KEYS,
  TOS_LINK_REL_VALUES,
} from "@service-policy-auditor/core";
import type { DOMAdapter, TosResult } from "./types.js";

// Patterns that should NOT be detected as ToS (privacy pages, etc.)
const TOS_EXCLUSION_PATTERNS = [
  /privacy/i,
  /プライバシー/,
  /datenschutz/i,
  /개인정보/,
  /隐私/,
  /隱私/,
];

function decodeUrlSafe(url: string): string {
  try {
    return decodeURIComponent(url);
  } catch {
    return url;
  }
}

function getPathFromUrl(url: string): string {
  try {
    return new URL(url).pathname;
  } catch {
    return url;
  }
}

function isExcludedUrl(url: string): boolean {
  const decoded = decodeUrlSafe(url);
  return TOS_EXCLUSION_PATTERNS.some(
    (pattern) => pattern.test(url) || pattern.test(decoded)
  );
}

function isPrivacyLink(text: string, url: string): boolean {
  const pathname = getPathFromUrl(url);
  const decodedPath = decodeUrlSafe(pathname);
  const decodedText = decodeUrlSafe(text);

  return (
    isPrivacyText(text) ||
    isPrivacyText(decodedText) ||
    isExcludedUrl(pathname) ||
    isPrivacyText(decodedPath)
  );
}

function isTosUrlWithDecode(url: string): boolean {
  const pathname = getPathFromUrl(url);
  const decoded = decodeUrlSafe(pathname);

  if (isExcludedUrl(pathname)) return false;
  if (isPrivacyText(decoded)) return false;

  if (isTosUrl(pathname)) return true;
  if (decoded !== pathname && isTosUrl(decoded)) return true;
  if (isTosText(decoded)) return true;

  return false;
}

function findFromLinkRel(dom: DOMAdapter): string | null {
  for (const rel of TOS_LINK_REL_VALUES) {
    const link = dom.querySelector(`link[rel="${rel}"]`);
    if (link) {
      const href = link.getAttribute("href");
      if (href) {
        return new URL(href, dom.getLocation().origin).href;
      }
    }
  }
  return null;
}

function findFromJsonLd(dom: DOMAdapter): string | null {
  const scripts = dom.querySelectorAll('script[type="application/ld+json"]');
  for (const script of scripts) {
    try {
      const data = JSON.parse(script.textContent || "");
      for (const key of TOS_JSONLD_KEYS) {
        if (data[key] && typeof data[key] === "string") {
          return data[key];
        }
        if (data["@graph"] && Array.isArray(data["@graph"])) {
          for (const item of data["@graph"]) {
            if (item[key] && typeof item[key] === "string") {
              return item[key];
            }
          }
        }
      }
    } catch {
      // skip invalid JSON
    }
  }
  return null;
}

function findFromOgMeta(dom: DOMAdapter): string | null {
  const ogUrl = dom
    .querySelector('meta[property="og:url"]')
    ?.getAttribute("content");
  if (ogUrl && TOS_OG_PATTERNS.some((p) => p.test(ogUrl))) {
    return ogUrl;
  }
  return null;
}

export function createTosFinder(dom: DOMAdapter) {
  return function findTermsOfService(): TosResult {
    const location = dom.getLocation();

    if (isTosUrlWithDecode(location.pathname)) {
      return { found: true, url: location.href, method: "url_pattern" };
    }

    const linkRelUrl = findFromLinkRel(dom);
    if (linkRelUrl) {
      return { found: true, url: linkRelUrl, method: "link_rel" };
    }

    const jsonLdUrl = findFromJsonLd(dom);
    if (jsonLdUrl) {
      return { found: true, url: jsonLdUrl, method: "json_ld" };
    }

    const ogUrl = findFromOgMeta(dom);
    if (ogUrl) {
      return { found: true, url: ogUrl, method: "og_meta" };
    }

    for (const selector of FOOTER_SELECTORS) {
      const links = dom.querySelectorAll<HTMLAnchorElement>(selector);
      for (const link of links) {
        const text = link.textContent?.trim() || "";
        const href = link.href;

        if (isPrivacyLink(text, href)) continue;

        if (isTosText(text)) {
          return { found: true, url: href, method: "link_text" };
        }

        if (href && isTosUrlWithDecode(href)) {
          return { found: true, url: href, method: "url_pattern" };
        }
      }
    }

    const MAX_LINKS_TO_SCAN = 500;
    const allLinks = Array.from(
      dom.querySelectorAll<HTMLAnchorElement>("a[href]")
    ).slice(0, MAX_LINKS_TO_SCAN);

    for (const link of allLinks) {
      const text = link.textContent?.trim() || "";
      const href = link.href;

      if (isPrivacyLink(text, href)) continue;

      if (isTosText(text) || isTosUrlWithDecode(href)) {
        return { found: true, url: href, method: "link_text" };
      }
    }

    return { found: false, url: null, method: "not_found" };
  };
}
