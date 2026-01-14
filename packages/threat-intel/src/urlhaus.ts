/**
 * @fileoverview URLhaus Integration
 *
 * Integration with URLhaus by abuse.ch for malware URL detection.
 * https://urlhaus.abuse.ch/
 */

import type {
  ThreatCheckResult,
  ThreatCategory,
  ThreatSeverity,
  URLhausResult,
} from "./types.js";

const URLHAUS_API_URL = "https://urlhaus-api.abuse.ch/v1/url/";
const URLHAUS_HOST_API_URL = "https://urlhaus-api.abuse.ch/v1/host/";

/**
 * Map URLhaus threat type to our category
 */
function mapThreatToCategory(threat: string): ThreatCategory {
  const mapping: Record<string, ThreatCategory> = {
    malware_download: "malware",
    elf: "malware",
    exe: "malware",
    doc: "malware",
    js: "malware",
    hta: "malware",
    phishing: "phishing",
    miner: "cryptominer",
    text: "unknown",
  };
  return mapping[threat.toLowerCase()] || "unknown";
}

/**
 * Map URLhaus status to severity
 */
function mapStatusToSeverity(status: string, threat: string): ThreatSeverity {
  if (status === "online") {
    if (threat.includes("ransomware")) return "critical";
    return "high";
  }
  if (status === "offline") {
    return "medium";
  }
  return "low";
}

/**
 * Check URL against URLhaus
 */
export async function checkURLhaus(url: string): Promise<ThreatCheckResult | null> {
  try {
    const formData = new URLSearchParams();
    formData.append("url", url);

    const response = await fetch(URLHAUS_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: formData.toString(),
    });

    if (!response.ok) {
      return null;
    }

    const data: URLhausResult = await response.json();

    if (data.query_status !== "ok" || !data.url_info) {
      return {
        indicator: url,
        type: "url",
        isThreat: false,
        severity: "info",
        categories: [],
        sources: [],
        confidence: 0,
        checkedAt: Date.now(),
        cached: false,
      };
    }

    const info = data.url_info;
    const category = mapThreatToCategory(info.threat);
    const severity = mapStatusToSeverity(info.url_status, info.threat);

    return {
      indicator: url,
      type: "url",
      isThreat: true,
      severity,
      categories: [category],
      sources: ["urlhaus"],
      confidence: info.url_status === "online" ? 90 : 70,
      checkedAt: Date.now(),
      cached: false,
    };
  } catch {
    return null;
  }
}

/**
 * Check domain/host against URLhaus
 */
export async function checkURLhausHost(host: string): Promise<ThreatCheckResult | null> {
  try {
    const formData = new URLSearchParams();
    formData.append("host", host);

    const response = await fetch(URLHAUS_HOST_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: formData.toString(),
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();

    if (data.query_status !== "ok") {
      return {
        indicator: host,
        type: "domain",
        isThreat: false,
        severity: "info",
        categories: [],
        sources: [],
        confidence: 0,
        checkedAt: Date.now(),
        cached: false,
      };
    }

    // Host has associated malicious URLs
    const urlCount = data.url_count || 0;
    const onlineCount = data.urls?.filter((u: { url_status: string }) => u.url_status === "online").length || 0;

    if (urlCount === 0) {
      return {
        indicator: host,
        type: "domain",
        isThreat: false,
        severity: "info",
        categories: [],
        sources: [],
        confidence: 0,
        checkedAt: Date.now(),
        cached: false,
      };
    }

    // Collect unique threat categories
    const categories: Set<ThreatCategory> = new Set();
    for (const url of data.urls || []) {
      categories.add(mapThreatToCategory(url.threat || "unknown"));
    }

    let severity: ThreatSeverity = "medium";
    if (onlineCount > 5) severity = "critical";
    else if (onlineCount > 0) severity = "high";

    return {
      indicator: host,
      type: "domain",
      isThreat: true,
      severity,
      categories: Array.from(categories),
      sources: ["urlhaus"],
      confidence: onlineCount > 0 ? 85 : 60,
      checkedAt: Date.now(),
      cached: false,
    };
  } catch {
    return null;
  }
}
