import {
  isPrivacyUrl,
  isPrivacyText,
  FOOTER_SELECTORS,
  OG_PRIVACY_PATTERNS,
  JSONLD_PRIVACY_KEYS,
  LINK_REL_PRIVACY_VALUES,
} from "@service-policy-auditor/core";

export type DetectionMethod =
  | "url_pattern"
  | "link_text"
  | "link_rel"
  | "json_ld"
  | "og_meta"
  | "not_found";

export interface PrivacyPolicyResult {
  found: boolean;
  url: string | null;
  method: DetectionMethod;
}

function decodeUrlSafe(url: string): string {
  try {
    return decodeURIComponent(url);
  } catch {
    return url;
  }
}

function isPrivacyUrlWithDecode(url: string): boolean {
  if (isPrivacyUrl(url)) return true;
  const decoded = decodeUrlSafe(url);
  return decoded !== url && isPrivacyUrl(decoded);
}

function findFromLinkRel(): string | null {
  for (const rel of LINK_REL_PRIVACY_VALUES) {
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
      for (const key of JSONLD_PRIVACY_KEYS) {
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
  if (ogUrl && OG_PRIVACY_PATTERNS.some((p) => p.test(ogUrl))) {
    return ogUrl;
  }
  return null;
}

export function findPrivacyPolicy(): PrivacyPolicyResult {
  if (isPrivacyUrlWithDecode(window.location.pathname)) {
    return { found: true, url: window.location.href, method: "url_pattern" };
  }

  const linkRelUrl = findFromLinkRel();
  if (linkRelUrl) {
    return { found: true, url: linkRelUrl, method: "link_rel" };
  }

  const jsonLdUrl = findFromJsonLd();
  if (jsonLdUrl) {
    return { found: true, url: jsonLdUrl, method: "json_ld" };
  }

  const ogUrl = findFromOgMeta();
  if (ogUrl) {
    return { found: true, url: ogUrl, method: "og_meta" };
  }

  for (const selector of FOOTER_SELECTORS) {
    const links = document.querySelectorAll<HTMLAnchorElement>(selector);
    for (const link of links) {
      const text = link.textContent?.trim() || "";
      const href = link.href;

      if (isPrivacyText(text)) {
        return { found: true, url: href, method: "link_text" };
      }

      if (href && isPrivacyUrlWithDecode(href)) {
        return { found: true, url: href, method: "url_pattern" };
      }
    }
  }

  const MAX_LINKS_TO_SCAN = 500;
  const allLinks = Array.from(
    document.querySelectorAll<HTMLAnchorElement>("a[href]")
  ).slice(0, MAX_LINKS_TO_SCAN);

  for (const link of allLinks) {
    const text = link.textContent?.trim() || "";
    const href = link.href;

    if (isPrivacyText(text) || isPrivacyUrlWithDecode(href)) {
      return { found: true, url: href, method: "link_text" };
    }
  }

  return { found: false, url: null, method: "not_found" };
}
