import {
  isPrivacyUrl,
  isPrivacyText,
  FOOTER_SELECTORS,
} from "@ai-service-exposure/core";

export interface PrivacyPolicyResult {
  found: boolean;
  url: string | null;
  method: "url_pattern" | "link_text" | "not_found";
}

export function findPrivacyPolicy(): PrivacyPolicyResult {
  // Method 1: Check current page URL
  if (isPrivacyUrl(window.location.pathname)) {
    return {
      found: true,
      url: window.location.href,
      method: "url_pattern",
    };
  }

  // Method 2: Search for links in footer areas
  for (const selector of FOOTER_SELECTORS) {
    const links = document.querySelectorAll<HTMLAnchorElement>(selector);
    for (const link of links) {
      const text = link.textContent?.trim() || "";
      const href = link.href;

      // Check link text
      if (isPrivacyText(text)) {
        return {
          found: true,
          url: href,
          method: "link_text",
        };
      }

      // Check link URL
      if (href && isPrivacyUrl(href)) {
        return {
          found: true,
          url: href,
          method: "url_pattern",
        };
      }
    }
  }

  // Method 3: Search all page links as fallback
  const allLinks = document.querySelectorAll<HTMLAnchorElement>("a[href]");
  for (const link of allLinks) {
    const text = link.textContent?.trim() || "";
    const href = link.href;

    if (isPrivacyText(text) || isPrivacyUrl(href)) {
      return {
        found: true,
        url: href,
        method: "link_text",
      };
    }
  }

  return {
    found: false,
    url: null,
    method: "not_found",
  };
}
