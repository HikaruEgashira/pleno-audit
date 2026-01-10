import {
  isPrivacyUrl,
  isPrivacyText,
  FOOTER_SELECTORS,
  OG_PRIVACY_PATTERNS,
  JSONLD_PRIVACY_KEYS,
  LINK_REL_PRIVACY_VALUES,
} from "@service-policy-auditor/core";
import type { DOMAdapter, PrivacyPolicyResult } from "./types.js";

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

function isPrivacyUrlWithDecode(url: string): boolean {
  const pathname = getPathFromUrl(url);
  const decoded = decodeUrlSafe(pathname);

  if (isPrivacyUrl(pathname)) return true;
  if (decoded !== pathname && isPrivacyUrl(decoded)) return true;
  if (isPrivacyText(decoded)) return true;

  return false;
}

function findFromLinkRel(dom: DOMAdapter): string | null {
  for (const rel of LINK_REL_PRIVACY_VALUES) {
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

function findFromOgMeta(dom: DOMAdapter): string | null {
  const ogUrl = dom
    .querySelector('meta[property="og:url"]')
    ?.getAttribute("content");
  if (ogUrl && OG_PRIVACY_PATTERNS.some((p) => p.test(ogUrl))) {
    return ogUrl;
  }
  return null;
}

export function createPrivacyFinder(dom: DOMAdapter) {
  return function findPrivacyPolicy(): PrivacyPolicyResult {
    const location = dom.getLocation();

    if (isPrivacyUrlWithDecode(location.pathname)) {
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
      dom.querySelectorAll<HTMLAnchorElement>("a[href]")
    ).slice(0, MAX_LINKS_TO_SCAN);

    for (const link of allLinks) {
      const text = link.textContent?.trim() || "";
      const href = link.href;

      if (isPrivacyText(text) || isPrivacyUrlWithDecode(href)) {
        return { found: true, url: href, method: "link_text" };
      }
    }

    return { found: false, url: null, method: "not_found" };
  };
}
