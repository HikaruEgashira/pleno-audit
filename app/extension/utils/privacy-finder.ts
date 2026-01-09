import {
  isPrivacyUrl,
  isPrivacyText,
  FOOTER_SELECTORS,
} from "@service-policy-controller/core";

export interface PrivacyPolicyResult {
  found: boolean;
  url: string | null;
  method: "url_pattern" | "link_text" | "not_found";
}

export function findPrivacyPolicy(): PrivacyPolicyResult {
  if (isPrivacyUrl(window.location.pathname)) {
    return {
      found: true,
      url: window.location.href,
      method: "url_pattern",
    };
  }

  for (const selector of FOOTER_SELECTORS) {
    const links = document.querySelectorAll<HTMLAnchorElement>(selector);
    for (const link of links) {
      const text = link.textContent?.trim() || "";
      const href = link.href;

      if (isPrivacyText(text)) {
        return {
          found: true,
          url: href,
          method: "link_text",
        };
      }

      if (href && isPrivacyUrl(href)) {
        return {
          found: true,
          url: href,
          method: "url_pattern",
        };
      }
    }
  }

  const MAX_LINKS_TO_SCAN = 500;
  const allLinks = Array.from(document.querySelectorAll<HTMLAnchorElement>("a[href]"))
    .slice(0, MAX_LINKS_TO_SCAN);

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
