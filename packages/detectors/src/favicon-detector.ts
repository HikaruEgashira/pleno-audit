/**
 * @fileoverview Favicon Detector
 *
 * ネットワークリクエストからfaviconのURLを検出する。
 * 外部通信なしで、既存の通信記録からfaviconを特定する。
 */

/**
 * Extract the filename from a URL path (last segment after /)
 * Returns lowercase for case-insensitive matching
 */
function getFilename(url: string): string {
  try {
    const pathname = new URL(url).pathname;
    const lastSlash = pathname.lastIndexOf("/");
    return pathname.slice(lastSlash + 1).toLowerCase();
  } catch {
    // Fallback: extract from raw URL
    const lastSlash = url.lastIndexOf("/");
    return url.slice(lastSlash + 1).toLowerCase();
  }
}

/**
 * Extract pathname from URL for path-based checks
 */
function getPathname(url: string): string {
  try {
    return new URL(url).pathname.toLowerCase();
  } catch {
    return url.toLowerCase();
  }
}

/**
 * Check if a URL is a favicon using string operations (ReDoS-safe)
 * Uses filename extraction to avoid regex backtracking issues
 */
function isFaviconUrl(url: string): boolean {
  const filename = getFilename(url);
  const pathname = getPathname(url);

  // Check .ico files (most common favicon format)
  if (filename.endsWith(".ico")) {
    return true;
  }

  // Check favicon*.png or favicon*.svg
  if (filename.startsWith("favicon") && (filename.endsWith(".png") || filename.endsWith(".svg"))) {
    return true;
  }

  // Check apple-touch-icon*.png
  if (filename.startsWith("apple-touch-icon") && filename.endsWith(".png")) {
    return true;
  }

  // Check android-chrome*.png
  if (filename.startsWith("android-chrome") && filename.endsWith(".png")) {
    return true;
  }

  // Check /icon*.png (e.g., icon-192x192.png)
  if (filename.startsWith("icon") && filename.endsWith(".png")) {
    return true;
  }

  // Check /icons/ directory pattern
  if (pathname.includes("/icons/") || pathname.includes("/icon/")) {
    if (filename.endsWith(".png") || filename.endsWith(".ico") || filename.endsWith(".svg")) {
      return true;
    }
  }

  return false;
}

function extractDomain(url: string): string | null {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

export interface FaviconRequest {
  url: string;
  domain: string;
  pageUrl?: string;
}

/**
 * ネットワークリクエストからfaviconのURLを検出する
 * pageUrl（リクエスト元ページ）が対象ドメインの場合も検出対象とする
 * @param domain 対象ドメイン
 * @param requests ネットワークリクエストの配列
 * @returns faviconのURL、見つからない場合はundefined
 */
export function findFaviconUrl(
  domain: string,
  requests: FaviconRequest[]
): string | undefined {
  for (const req of requests) {
    // リクエスト先が同じドメイン、またはpageUrl（リクエスト元）が同じドメインの場合
    const reqDomain = extractDomain(req.url);
    const pageDomain = req.pageUrl ? extractDomain(req.pageUrl) : null;

    const isFromTargetDomain = reqDomain === domain || pageDomain === domain;

    if (isFromTargetDomain && isFaviconUrl(req.url)) {
      return req.url;
    }
  }
  return undefined;
}

/**
 * 複数ドメインのfaviconを一括検出する
 * @param domains 対象ドメインの配列
 * @param requests ネットワークリクエストの配列
 * @returns ドメインをキーとしたfaviconURLのマップ
 */
export function findFavicons(
  domains: string[],
  requests: FaviconRequest[]
): Map<string, string> {
  const result = new Map<string, string>();

  for (const domain of domains) {
    const faviconUrl = findFaviconUrl(domain, requests);
    if (faviconUrl) {
      result.set(domain, faviconUrl);
    }
  }

  return result;
}
