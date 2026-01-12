/**
 * @fileoverview Favicon Detector
 *
 * ネットワークリクエストからfaviconのURLを検出する。
 * 外部通信なしで、既存の通信記録からfaviconを特定する。
 */

const FAVICON_PATTERNS = [
  /\.ico$/i,  // 全ての.icoファイル
  /favicon.*\.(png|svg)$/i,
  /apple-touch-icon.*\.png$/i,
  /\/icon-?\d*x?\d*\.png$/i,
  /\/icons?\/.*\.(png|ico|svg)$/i,
  /android-chrome.*\.png$/i,
];

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

    if (isFromTargetDomain) {
      for (const pattern of FAVICON_PATTERNS) {
        if (pattern.test(req.url)) {
          return req.url;
        }
      }
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
