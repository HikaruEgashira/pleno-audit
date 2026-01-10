import {
  isTosUrl,
  isTosText,
  isPrivacyText,
  FOOTER_SELECTORS,
  TOS_OG_PATTERNS,
  TOS_JSONLD_KEYS,
  TOS_LINK_REL_VALUES,
} from "@service-policy-auditor/core";

export type TosDetectionMethod =
  | "url_pattern"
  | "link_text"
  | "link_rel"
  | "json_ld"
  | "og_meta"
  | "not_found";

export interface TosResult {
  found: boolean;
  url: string | null;
  method: TosDetectionMethod;
}

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

  // Check if text or URL indicates privacy content
  return (
    isPrivacyText(text) ||
    isPrivacyText(decodedText) ||
    isExcludedUrl(pathname) ||
    isPrivacyText(decodedPath)
  );
}

function isTosUrlWithDecode(url: string): boolean {
  // Extract pathname to avoid matching domain parts
  const pathname = getPathFromUrl(url);
  const decoded = decodeUrlSafe(pathname);

  // Check exclusion patterns first (both URL patterns and text patterns)
  if (isExcludedUrl(pathname)) return false;
  if (isPrivacyText(decoded)) return false;

  // Check URL patterns
  if (isTosUrl(pathname)) return true;
  if (decoded !== pathname && isTosUrl(decoded)) return true;

  // Also check text patterns on decoded pathname (for Japanese/CJK URLs)
  if (isTosText(decoded)) return true;

  return false;
}

function findFromLinkRel(): string | null {
  for (const rel of TOS_LINK_REL_VALUES) {
    const link = document.querySelector(`link[rel="${rel}"]`);
    if (link) {
      const href = link.getAttribute("href");
      if (href) {
        return new URL(href, window.location.origin).href;
      }
    }
  }
  return null;
}

function findFromJsonLd(): string | null {
  const scripts = document.querySelectorAll('script[type="application/ld+json"]');
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

function findFromOgMeta(): string | null {
  const ogUrl = document
    .querySelector('meta[property="og:url"]')
    ?.getAttribute("content");
  if (ogUrl && TOS_OG_PATTERNS.some((p) => p.test(ogUrl))) {
    return ogUrl;
  }
  return null;
}

export function findTermsOfService(): TosResult {
  // 1. Check if current URL is a ToS page
  if (isTosUrlWithDecode(window.location.pathname)) {
    return { found: true, url: window.location.href, method: "url_pattern" };
  }

  // 2. Check link[rel] metadata
  const linkRelUrl = findFromLinkRel();
  if (linkRelUrl) {
    return { found: true, url: linkRelUrl, method: "link_rel" };
  }

  // 3. Check JSON-LD
  const jsonLdUrl = findFromJsonLd();
  if (jsonLdUrl) {
    return { found: true, url: jsonLdUrl, method: "json_ld" };
  }

  // 4. Check OG meta
  const ogUrl = findFromOgMeta();
  if (ogUrl) {
    return { found: true, url: ogUrl, method: "og_meta" };
  }

  // 5. Search footer links
  for (const selector of FOOTER_SELECTORS) {
    const links = document.querySelectorAll<HTMLAnchorElement>(selector);
    for (const link of links) {
      const text = link.textContent?.trim() || "";
      const href = link.href;

      // Skip privacy-related links
      if (isPrivacyLink(text, href)) continue;

      if (isTosText(text)) {
        return { found: true, url: href, method: "link_text" };
      }

      if (href && isTosUrlWithDecode(href)) {
        return { found: true, url: href, method: "url_pattern" };
      }
    }
  }

  // 6. Fallback: scan all links
  const MAX_LINKS_TO_SCAN = 500;
  const allLinks = Array.from(
    document.querySelectorAll<HTMLAnchorElement>("a[href]")
  ).slice(0, MAX_LINKS_TO_SCAN);

  for (const link of allLinks) {
    const text = link.textContent?.trim() || "";
    const href = link.href;

    // Skip privacy-related links
    if (isPrivacyLink(text, href)) continue;

    if (isTosText(text) || isTosUrlWithDecode(href)) {
      return { found: true, url: href, method: "link_text" };
    }
  }

  return { found: false, url: null, method: "not_found" };
}
