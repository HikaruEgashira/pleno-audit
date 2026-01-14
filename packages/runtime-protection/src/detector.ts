/**
 * @fileoverview Runtime Threat Detector
 *
 * Real-time threat detection engine for browser security.
 * Wiz Defend-style runtime protection.
 */

import type {
  RuntimeThreat,
  ThreatType,
  ThreatSeverity,
  ThreatStatus,
  DetectionSource,
  ThreatIndicator,
  MitigationAction,
  MitigationActionType,
  RuntimeProtectionConfig,
  RuntimeStats,
  SecurityIncident,
} from "./types.js";
import { DEFAULT_RUNTIME_CONFIG } from "./types.js";

export interface RuntimeProtectionStore {
  getThreats(): Promise<RuntimeThreat[]>;
  saveThreat(threat: RuntimeThreat): Promise<void>;
  updateThreat(id: string, updates: Partial<RuntimeThreat>): Promise<void>;
  getIncidents(): Promise<SecurityIncident[]>;
  saveIncident(incident: SecurityIncident): Promise<void>;
  updateIncident(id: string, updates: Partial<SecurityIncident>): Promise<void>;
}

export interface ThreatListener {
  (threat: RuntimeThreat): void;
}

export interface RuntimeProtector {
  detectThreat(event: ThreatDetectionEvent): Promise<RuntimeThreat | null>;
  getActiveThreats(): Promise<RuntimeThreat[]>;
  mitigateThreat(threatId: string, action: MitigationActionType): Promise<void>;
  updateThreatStatus(threatId: string, status: ThreatStatus): Promise<void>;
  createIncident(threatIds: string[], title: string): Promise<SecurityIncident>;
  getStats(): Promise<RuntimeStats>;
  subscribe(listener: ThreatListener): () => void;
}

/**
 * Event that can trigger threat detection
 */
export interface ThreatDetectionEvent {
  source: DetectionSource;
  domain: string;
  url?: string;
  timestamp: number;
  data: Record<string, unknown>;
}

/**
 * Create in-memory store
 */
export function createInMemoryRuntimeStore(): RuntimeProtectionStore {
  const threats = new Map<string, RuntimeThreat>();
  const incidents = new Map<string, SecurityIncident>();

  return {
    async getThreats() {
      return Array.from(threats.values()).sort(
        (a, b) => b.timestamp - a.timestamp
      );
    },
    async saveThreat(threat) {
      threats.set(threat.id, threat);
    },
    async updateThreat(id, updates) {
      const threat = threats.get(id);
      if (threat) {
        threats.set(id, { ...threat, ...updates });
      }
    },
    async getIncidents() {
      return Array.from(incidents.values()).sort(
        (a, b) => b.createdAt - a.createdAt
      );
    },
    async saveIncident(incident) {
      incidents.set(incident.id, incident);
    },
    async updateIncident(id, updates) {
      const incident = incidents.get(id);
      if (incident) {
        incidents.set(id, { ...incident, ...updates, updatedAt: Date.now() });
      }
    },
  };
}

/**
 * Create runtime protector
 */
export function createRuntimeProtector(
  config: Partial<RuntimeProtectionConfig> = {},
  store?: RuntimeProtectionStore
): RuntimeProtector {
  const finalConfig = { ...DEFAULT_RUNTIME_CONFIG, ...config };
  const internalStore = store || createInMemoryRuntimeStore();
  const listeners = new Set<ThreatListener>();

  function generateId(): string {
    return `threat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  function generateIncidentId(): string {
    return `incident_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Analyze event and detect threat
   */
  async function detectThreat(
    event: ThreatDetectionEvent
  ): Promise<RuntimeThreat | null> {
    if (!finalConfig.enabled) return null;

    const { source, domain, url, timestamp, data } = event;
    let threat: RuntimeThreat | null = null;

    // NRD Detection
    if (source === "nrd_detector" && data.isNRD) {
      threat = createThreat({
        type: "phishing",
        severity: data.confidence === "high" ? "high" : "medium",
        source,
        domain,
        url,
        timestamp,
        title: "新規登録ドメイン (NRD) へのアクセス",
        description: `${domain} は最近登録されたドメインです。フィッシングサイトの可能性があります。`,
        indicators: [
          {
            type: "domain",
            value: domain,
            confidence: confidenceToNumber(data.confidence as string),
            source: "nrd_detector",
          },
        ],
        riskFactors: ["newly_registered_domain", "potential_phishing"],
      });
    }

    // Typosquat Detection
    if (source === "typosquat_detector" && data.isTyposquat) {
      threat = createThreat({
        type: "phishing",
        severity: "high",
        source,
        domain,
        url,
        timestamp,
        title: "タイポスクワットドメインへのアクセス",
        description: `${domain} は ${data.similarTo || "有名サイト"} に類似したドメインです。偽サイトの可能性があります。`,
        indicators: [
          {
            type: "domain",
            value: domain,
            confidence: 0.9,
            source: "typosquat_detector",
          },
        ],
        riskFactors: ["typosquatting", "brand_impersonation"],
      });
    }

    // Threat Intel Detection
    if (source === "threat_intel" && data.isMalicious) {
      threat = createThreat({
        type: data.category as ThreatType || "malware",
        severity: (data.severity as ThreatSeverity) || "high",
        source,
        domain,
        url,
        timestamp,
        title: "既知の脅威サイトへのアクセス",
        description: `${domain} は脅威インテリジェンスにより悪意のあるサイトとして報告されています。`,
        indicators: [
          {
            type: "domain",
            value: domain,
            confidence: 0.95,
            source: data.source as string || "threat_intel",
          },
        ],
        riskFactors: ["known_malicious", "threat_intel_match"],
      });
    }

    // AI Data Exfiltration Detection
    if (source === "ai_monitor" && data.hasSensitiveData) {
      threat = createThreat({
        type: "data_exfiltration",
        severity: "high",
        source,
        domain,
        url,
        timestamp,
        title: "機密データのAIへの送信検出",
        description: `${domain} で機密情報（${(data.dataTypes as string[])?.join(", ") || "不明"}）がAIサービスに送信されました。`,
        indicators: [
          {
            type: "behavior",
            value: "sensitive_data_to_ai",
            confidence: 0.8,
            source: "ai_monitor",
          },
        ],
        riskFactors: ["data_leakage", "ai_service", "sensitive_data"],
      });
    }

    // CSP Violation - Potential XSS
    if (source === "csp_monitor" && data.directive === "script-src") {
      const violations = (data.violationCount as number) || 1;
      if (violations > 5) {
        threat = createThreat({
          type: "xss_attempt",
          severity: violations > 20 ? "high" : "medium",
          source,
          domain,
          url,
          timestamp,
          title: "複数のスクリプトCSP違反を検出",
          description: `${domain} で ${violations} 件のscript-src違反が発生しました。XSS攻撃の可能性があります。`,
          indicators: [
            {
              type: "pattern",
              value: `csp_violation:script-src:${violations}`,
              confidence: 0.6,
              source: "csp_monitor",
            },
          ],
          riskFactors: ["csp_violation", "script_injection"],
        });
      }
    }

    // Extension Suspicious Activity
    if (source === "extension_monitor" && data.isSuspicious) {
      threat = createThreat({
        type: "unauthorized_access",
        severity: "medium",
        source,
        domain,
        url,
        timestamp,
        title: "拡張機能の不審なアクティビティ",
        description: `拡張機能 "${data.extensionName || "不明"}" が ${data.requestCount || "多数の"} リクエストを送信しています。`,
        indicators: [
          {
            type: "behavior",
            value: `extension_activity:${data.extensionId}`,
            confidence: 0.7,
            source: "extension_monitor",
          },
        ],
        riskFactors: ["extension_risk", "excessive_requests"],
      });
    }

    if (threat) {
      await internalStore.saveThreat(threat);

      // Notify listeners
      for (const listener of listeners) {
        listener(threat);
      }

      // Auto-mitigate if configured
      if (
        finalConfig.autoMitigate &&
        shouldAutoMitigate(threat.severity, finalConfig.alertThreshold)
      ) {
        await mitigateThreat(threat.id, "notify_user");
      }
    }

    return threat;
  }

  function createThreat(params: {
    type: ThreatType;
    severity: ThreatSeverity;
    source: DetectionSource;
    domain: string;
    url?: string;
    timestamp: number;
    title: string;
    description: string;
    indicators: ThreatIndicator[];
    riskFactors: string[];
  }): RuntimeThreat {
    return {
      id: generateId(),
      type: params.type,
      severity: params.severity,
      status: "active",
      source: params.source,
      timestamp: params.timestamp,
      domain: params.domain,
      url: params.url,
      title: params.title,
      description: params.description,
      indicators: params.indicators,
      context: {
        riskFactors: params.riskFactors,
      },
      mitigationActions: [],
      timeline: [
        {
          timestamp: params.timestamp,
          event: "Threat detected",
          actor: "system",
          details: { source: params.source },
        },
      ],
      relatedThreats: [],
      notes: [],
    };
  }

  function confidenceToNumber(confidence: string): number {
    switch (confidence) {
      case "high":
        return 0.9;
      case "medium":
        return 0.7;
      case "low":
        return 0.5;
      default:
        return 0.5;
    }
  }

  function shouldAutoMitigate(
    severity: ThreatSeverity,
    threshold: ThreatSeverity
  ): boolean {
    const levels: ThreatSeverity[] = ["info", "low", "medium", "high", "critical"];
    return levels.indexOf(severity) >= levels.indexOf(threshold);
  }

  /**
   * Get active threats
   */
  async function getActiveThreats(): Promise<RuntimeThreat[]> {
    const threats = await internalStore.getThreats();
    return threats.filter((t) => t.status === "active" || t.status === "investigating");
  }

  /**
   * Mitigate a threat
   */
  async function mitigateThreat(
    threatId: string,
    actionType: MitigationActionType
  ): Promise<void> {
    const threats = await internalStore.getThreats();
    const threat = threats.find((t) => t.id === threatId);
    if (!threat) return;

    const action: MitigationAction = {
      id: `action_${Date.now()}`,
      type: actionType,
      status: "completed",
      description: getMitigationDescription(actionType),
      timestamp: Date.now(),
    };

    threat.mitigationActions.push(action);
    threat.timeline.push({
      timestamp: Date.now(),
      event: `Mitigation action: ${actionType}`,
      actor: "system",
    });

    await internalStore.updateThreat(threatId, {
      mitigationActions: threat.mitigationActions,
      timeline: threat.timeline,
      status: actionType === "manual_review" ? "investigating" : "mitigated",
    });
  }

  function getMitigationDescription(actionType: MitigationActionType): string {
    const descriptions: Record<MitigationActionType, string> = {
      block_domain: "ドメインをブロックしました",
      close_tab: "タブを閉じました",
      clear_cookies: "Cookieを削除しました",
      notify_user: "ユーザーに通知しました",
      log_incident: "インシデントを記録しました",
      quarantine: "リソースを隔離しました",
      report_threat: "脅威を報告しました",
      manual_review: "手動レビューのためにフラグを付けました",
    };
    return descriptions[actionType];
  }

  /**
   * Update threat status
   */
  async function updateThreatStatus(
    threatId: string,
    status: ThreatStatus
  ): Promise<void> {
    const threats = await internalStore.getThreats();
    const threat = threats.find((t) => t.id === threatId);
    if (!threat) return;

    threat.timeline.push({
      timestamp: Date.now(),
      event: `Status changed to: ${status}`,
      actor: "user",
    });

    const updates: Partial<RuntimeThreat> = {
      status,
      timeline: threat.timeline,
    };

    if (status === "resolved") {
      updates.resolvedAt = Date.now();
    }

    await internalStore.updateThreat(threatId, updates);
  }

  /**
   * Create incident from threats
   */
  async function createIncident(
    threatIds: string[],
    title: string
  ): Promise<SecurityIncident> {
    const threats = await internalStore.getThreats();
    const relatedThreats = threats.filter((t) => threatIds.includes(t.id));

    const maxSeverity = relatedThreats.reduce((max, t) => {
      const levels: ThreatSeverity[] = ["info", "low", "medium", "high", "critical"];
      return levels.indexOf(t.severity) > levels.indexOf(max) ? t.severity : max;
    }, "info" as ThreatSeverity);

    const incident: SecurityIncident = {
      id: generateIncidentId(),
      title,
      severity: maxSeverity,
      status: "open",
      threats: threatIds,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      summary: `${relatedThreats.length}件の脅威に関連するセキュリティインシデント`,
      impact: relatedThreats.map((t) => t.domain).join(", ") + " が影響を受けています",
      timeline: [
        {
          timestamp: Date.now(),
          type: "created",
          actor: "user",
          description: "インシデントが作成されました",
        },
      ],
      tags: [...new Set(relatedThreats.map((t) => t.type))],
    };

    await internalStore.saveIncident(incident);

    // Update threats with incident reference
    for (const threatId of threatIds) {
      await internalStore.updateThreat(threatId, {
        status: "investigating",
      });
    }

    return incident;
  }

  /**
   * Get runtime stats
   */
  async function getStats(): Promise<RuntimeStats> {
    const threats = await internalStore.getThreats();
    const incidents = await internalStore.getIncidents();
    const now = Date.now();
    const dayAgo = now - 24 * 60 * 60 * 1000;
    const weekAgo = now - 7 * 24 * 60 * 60 * 1000;

    const activeThreats = threats.filter(
      (t) => t.status === "active" || t.status === "investigating"
    );
    const threatsToday = threats.filter((t) => t.timestamp >= dayAgo);
    const threatsThisWeek = threats.filter((t) => t.timestamp >= weekAgo);
    const mitigatedThreats = threats.filter(
      (t) => t.status === "mitigated" || t.status === "resolved"
    );
    const openIncidents = incidents.filter(
      (i) => i.status === "open" || i.status === "investigating"
    );

    const threatsByType: Record<ThreatType, number> = {} as any;
    const threatsBySeverity: Record<ThreatSeverity, number> = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      info: 0,
    };
    const detectionSources: Record<DetectionSource, number> = {} as any;
    const domainCounts: Record<string, number> = {};

    for (const threat of threats) {
      threatsByType[threat.type] = (threatsByType[threat.type] || 0) + 1;
      threatsBySeverity[threat.severity]++;
      detectionSources[threat.source] =
        (detectionSources[threat.source] || 0) + 1;
      domainCounts[threat.domain] = (domainCounts[threat.domain] || 0) + 1;
    }

    const topThreatDomains = Object.entries(domainCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([domain, count]) => ({ domain, count }));

    return {
      activeThreats: activeThreats.length,
      threatsToday: threatsToday.length,
      threatsThisWeek: threatsThisWeek.length,
      mitigatedThreats: mitigatedThreats.length,
      openIncidents: openIncidents.length,
      threatsByType,
      threatsBySeverity,
      topThreatDomains,
      detectionSources,
    };
  }

  /**
   * Subscribe to threat events
   */
  function subscribe(listener: ThreatListener): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  return {
    detectThreat,
    getActiveThreats,
    mitigateThreat,
    updateThreatStatus,
    createIncident,
    getStats,
    subscribe,
  };
}
