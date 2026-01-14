/**
 * @fileoverview Security Graph Builder
 *
 * Builds the security graph from various event sources
 * and detected services data.
 */

import type {
  EventLog,
  DetectedService,
  ExtensionRequestDetails,
} from "@pleno-audit/detectors";
import type {
  SecurityGraph,
  GraphNode,
  GraphEdge,
  NodeType,
  EdgeType,
  DomainMetadata,
  AIProviderMetadata,
  ExtensionMetadata,
  DataTypeMetadata,
  GraphStats,
  AttackPath,
  RiskLevel,
  DataClassification,
} from "./types.js";
import {
  calculateRiskScore,
  scoreToRiskLevel,
  riskLevelPriority,
  type RiskFactors,
} from "./risk-calculator.js";
import {
  detectSensitiveData,
  getHighestRiskClassification,
} from "./sensitive-data-detector.js";

/**
 * Create an empty security graph
 */
export function createSecurityGraph(): SecurityGraph {
  return {
    nodes: new Map(),
    edges: new Map(),
    lastUpdated: Date.now(),
    stats: createEmptyStats(),
  };
}

function createEmptyStats(): GraphStats {
  return {
    totalNodes: 0,
    totalEdges: 0,
    nodesByType: {
      domain: 0,
      ai_provider: 0,
      extension: 0,
      user: 0,
      data_type: 0,
    },
    edgesByType: {
      requests: 0,
      sends_data: 0,
      authenticates: 0,
      redirects: 0,
      hosts_cookie: 0,
      ai_prompt: 0,
      extension_request: 0,
    },
    riskDistribution: {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      info: 0,
    },
    criticalPaths: [],
  };
}

/**
 * Build security graph from services and events
 */
export function buildSecurityGraph(
  services: DetectedService[],
  events: EventLog[]
): SecurityGraph {
  const graph = createSecurityGraph();

  // Add domain nodes from services
  for (const service of services) {
    addDomainNode(graph, service);
  }

  // Process events to add edges and additional nodes
  for (const event of events) {
    processEvent(graph, event);
  }

  // Calculate stats
  updateGraphStats(graph);

  // Find critical attack paths
  graph.stats.criticalPaths = findAttackPaths(graph);

  return graph;
}

/**
 * Add a domain node from detected service
 */
function addDomainNode(graph: SecurityGraph, service: DetectedService): void {
  const nodeId = `domain:${service.domain}`;

  const riskFactors: RiskFactors = {
    isNRD: service.nrdResult?.isNRD,
    nrdConfidence: service.nrdResult?.confidence,
    isTyposquat: service.typosquatResult?.isTyposquat,
    typosquatConfidence: service.typosquatResult?.confidence,
    hasLogin: service.hasLoginPage,
    hasPrivacyPolicy: !!service.privacyPolicyUrl,
    hasTermsOfService: !!service.termsOfServiceUrl,
  };

  const riskScore = calculateRiskScore(riskFactors);

  const metadata: DomainMetadata = {
    type: "domain",
    domain: service.domain,
    hasLogin: service.hasLoginPage,
    hasPrivacyPolicy: !!service.privacyPolicyUrl,
    hasTermsOfService: !!service.termsOfServiceUrl,
    isNRD: service.nrdResult?.isNRD ?? false,
    nrdConfidence: service.nrdResult?.confidence,
    isTyposquat: service.typosquatResult?.isTyposquat ?? false,
    typosquatConfidence: service.typosquatResult?.confidence,
    faviconUrl: service.faviconUrl,
    cookieCount: service.cookies.length,
    sessionCookieCount: service.cookies.filter((c) => c.isSession).length,
  };

  const node: GraphNode = {
    id: nodeId,
    type: "domain",
    label: service.domain,
    metadata,
    riskScore,
    riskLevel: scoreToRiskLevel(riskScore),
    firstSeen: service.detectedAt,
    lastSeen: service.detectedAt,
  };

  graph.nodes.set(nodeId, node);
}

/**
 * Process an event to update graph
 */
function processEvent(graph: SecurityGraph, event: EventLog): void {
  switch (event.type) {
    case "ai_prompt_sent":
      processAIPrompt(graph, event);
      break;
    case "ai_response_received":
      processAIResponse(graph, event);
      break;
    case "extension_request":
      processExtensionRequest(graph, event);
      break;
    case "network_request":
      processNetworkRequest(graph, event);
      break;
    case "login_detected":
      processLoginDetected(graph, event);
      break;
    case "csp_violation":
      processCSPViolation(graph, event);
      break;
  }
}

/**
 * Process AI prompt event
 */
function processAIPrompt(
  graph: SecurityGraph,
  event: EventLog & { type: "ai_prompt_sent" }
): void {
  const { domain, details, timestamp } = event;
  const provider = details.inferredProvider || "unknown";
  const aiNodeId = `ai_provider:${provider}`;
  const domainNodeId = `domain:${domain}`;

  // Ensure domain node exists
  ensureDomainNode(graph, domain, timestamp);

  // Add or update AI provider node
  if (!graph.nodes.has(aiNodeId)) {
    const metadata: AIProviderMetadata = {
      type: "ai_provider",
      provider,
      models: details.model ? [details.model] : [],
      promptCount: 1,
      totalTokensEstimate: details.promptContent?.text?.length || 0,
    };

    const node: GraphNode = {
      id: aiNodeId,
      type: "ai_provider",
      label: provider,
      metadata,
      riskScore: 10, // Base AI risk
      riskLevel: "low",
      firstSeen: timestamp,
      lastSeen: timestamp,
    };

    graph.nodes.set(aiNodeId, node);
  } else {
    const node = graph.nodes.get(aiNodeId)!;
    const metadata = node.metadata as AIProviderMetadata;
    metadata.promptCount++;
    if (details.model && !metadata.models.includes(details.model)) {
      metadata.models.push(details.model);
    }
    metadata.totalTokensEstimate += details.promptContent?.text?.length || 0;
    node.lastSeen = timestamp;
  }

  // Analyze sensitive data in prompt
  const promptText = details.promptContent?.text || "";
  const sensitiveData = detectSensitiveData(promptText);
  const dataTypes = [
    ...new Set(sensitiveData.map((s) => s.classification)),
  ] as DataClassification[];

  // Add data type nodes for sensitive data found
  for (const dataType of dataTypes) {
    addDataTypeNode(graph, dataType, domain, timestamp);
  }

  // Create edge from domain to AI provider
  const edgeId = `${domainNodeId}:ai_prompt:${aiNodeId}`;
  if (!graph.edges.has(edgeId)) {
    const edge: GraphEdge = {
      id: edgeId,
      type: "ai_prompt",
      source: domainNodeId,
      target: aiNodeId,
      weight: 1,
      riskScore: sensitiveData.length > 0 ? 50 : 10,
      riskLevel: sensitiveData.length > 0 ? "medium" : "low",
      metadata: {
        requestCount: 1,
        dataTypes,
        hasCredentials: dataTypes.includes("credentials"),
        hasPII: dataTypes.includes("pii"),
      },
      firstSeen: timestamp,
      lastSeen: timestamp,
    };
    graph.edges.set(edgeId, edge);
  } else {
    const edge = graph.edges.get(edgeId)!;
    edge.weight++;
    edge.metadata.requestCount = (edge.metadata.requestCount || 0) + 1;
    if (dataTypes.length > 0) {
      edge.metadata.dataTypes = [
        ...new Set([...(edge.metadata.dataTypes || []), ...dataTypes]),
      ];
      edge.metadata.hasCredentials =
        edge.metadata.hasCredentials || dataTypes.includes("credentials");
      edge.metadata.hasPII =
        edge.metadata.hasPII || dataTypes.includes("pii");
      edge.riskScore = Math.max(edge.riskScore, 50);
      edge.riskLevel = scoreToRiskLevel(edge.riskScore);
    }
    edge.lastSeen = timestamp;
  }
}

/**
 * Process AI response event
 */
function processAIResponse(
  graph: SecurityGraph,
  event: EventLog & { type: "ai_response_received" }
): void {
  // Update AI provider stats
  const provider = event.details.inferredProvider || "unknown";
  const aiNodeId = `ai_provider:${provider}`;

  if (graph.nodes.has(aiNodeId)) {
    const node = graph.nodes.get(aiNodeId)!;
    node.lastSeen = event.timestamp;
  }
}

/**
 * Process extension request event
 */
function processExtensionRequest(
  graph: SecurityGraph,
  event: EventLog & { type: "extension_request" }
): void {
  const { details, timestamp } = event;
  const extNodeId = `extension:${details.extensionId}`;

  // Add or update extension node
  if (!graph.nodes.has(extNodeId)) {
    const metadata: ExtensionMetadata = {
      type: "extension",
      extensionId: details.extensionId,
      extensionName: details.extensionName,
      requestCount: 1,
      uniqueDomains: 1,
    };

    const riskScore = calculateRiskScore({
      extensionRequestCount: 1,
    });

    const node: GraphNode = {
      id: extNodeId,
      type: "extension",
      label: details.extensionName,
      metadata,
      riskScore,
      riskLevel: scoreToRiskLevel(riskScore),
      firstSeen: timestamp,
      lastSeen: timestamp,
    };

    graph.nodes.set(extNodeId, node);
  } else {
    const node = graph.nodes.get(extNodeId)!;
    const metadata = node.metadata as ExtensionMetadata;
    metadata.requestCount++;
    node.riskScore = calculateRiskScore({
      extensionRequestCount: metadata.requestCount,
    });
    node.riskLevel = scoreToRiskLevel(node.riskScore);
    node.lastSeen = timestamp;
  }

  // Parse target domain from URL
  try {
    const url = new URL(details.url);
    const targetDomain = url.hostname;
    const targetNodeId = `domain:${targetDomain}`;

    ensureDomainNode(graph, targetDomain, timestamp);

    // Create edge from extension to domain
    const edgeId = `${extNodeId}:extension_request:${targetNodeId}`;
    if (!graph.edges.has(edgeId)) {
      const edge: GraphEdge = {
        id: edgeId,
        type: "extension_request",
        source: extNodeId,
        target: targetNodeId,
        weight: 1,
        riskScore: 15,
        riskLevel: "low",
        metadata: {
          requestCount: 1,
          methods: [details.method],
        },
        firstSeen: timestamp,
        lastSeen: timestamp,
      };
      graph.edges.set(edgeId, edge);
    } else {
      const edge = graph.edges.get(edgeId)!;
      edge.weight++;
      edge.metadata.requestCount = (edge.metadata.requestCount || 0) + 1;
      if (
        details.method &&
        !edge.metadata.methods?.includes(details.method)
      ) {
        edge.metadata.methods = [
          ...(edge.metadata.methods || []),
          details.method,
        ];
      }
      edge.lastSeen = timestamp;
    }
  } catch {
    // Invalid URL, skip
  }
}

/**
 * Process network request event
 */
function processNetworkRequest(
  graph: SecurityGraph,
  event: EventLog & { type: "network_request" }
): void {
  const { domain, details, timestamp } = event;

  ensureDomainNode(graph, domain, timestamp);

  // Parse target from URL
  try {
    const url = new URL(details.url);
    const targetDomain = url.hostname;

    if (targetDomain !== domain) {
      const sourceNodeId = `domain:${domain}`;
      const targetNodeId = `domain:${targetDomain}`;

      ensureDomainNode(graph, targetDomain, timestamp);

      // Create cross-domain request edge
      const edgeId = `${sourceNodeId}:requests:${targetNodeId}`;
      if (!graph.edges.has(edgeId)) {
        const edge: GraphEdge = {
          id: edgeId,
          type: "requests",
          source: sourceNodeId,
          target: targetNodeId,
          weight: 1,
          riskScore: 5,
          riskLevel: "info",
          metadata: {
            requestCount: 1,
            methods: [details.method],
          },
          firstSeen: timestamp,
          lastSeen: timestamp,
        };
        graph.edges.set(edgeId, edge);
      } else {
        const edge = graph.edges.get(edgeId)!;
        edge.weight++;
        edge.lastSeen = timestamp;
      }
    }
  } catch {
    // Invalid URL, skip
  }
}

/**
 * Process login detected event
 */
function processLoginDetected(
  graph: SecurityGraph,
  event: EventLog & { type: "login_detected" }
): void {
  const { domain, timestamp } = event;
  const nodeId = `domain:${domain}`;

  ensureDomainNode(graph, domain, timestamp);

  const node = graph.nodes.get(nodeId);
  if (node && node.metadata.type === "domain") {
    (node.metadata as DomainMetadata).hasLogin = true;
    // Recalculate risk
    node.riskScore = calculateRiskScore({
      hasLogin: true,
      hasPrivacyPolicy: (node.metadata as DomainMetadata).hasPrivacyPolicy,
      hasTermsOfService: (node.metadata as DomainMetadata).hasTermsOfService,
      isNRD: (node.metadata as DomainMetadata).isNRD,
      nrdConfidence: (node.metadata as DomainMetadata).nrdConfidence,
      isTyposquat: (node.metadata as DomainMetadata).isTyposquat,
      typosquatConfidence: (node.metadata as DomainMetadata)
        .typosquatConfidence,
    });
    node.riskLevel = scoreToRiskLevel(node.riskScore);
  }
}

/**
 * Process CSP violation event
 */
function processCSPViolation(
  graph: SecurityGraph,
  event: EventLog & { type: "csp_violation" }
): void {
  const { domain, timestamp } = event;
  const nodeId = `domain:${domain}`;

  ensureDomainNode(graph, domain, timestamp);

  const node = graph.nodes.get(nodeId);
  if (node) {
    // Increase risk score for CSP violations
    node.riskScore = Math.min(100, node.riskScore + 5);
    node.riskLevel = scoreToRiskLevel(node.riskScore);
  }
}

/**
 * Ensure a domain node exists
 */
function ensureDomainNode(
  graph: SecurityGraph,
  domain: string,
  timestamp: number
): void {
  const nodeId = `domain:${domain}`;
  if (!graph.nodes.has(nodeId)) {
    const metadata: DomainMetadata = {
      type: "domain",
      domain,
      hasLogin: false,
      hasPrivacyPolicy: false,
      hasTermsOfService: false,
      isNRD: false,
      isTyposquat: false,
      cookieCount: 0,
      sessionCookieCount: 0,
    };

    const node: GraphNode = {
      id: nodeId,
      type: "domain",
      label: domain,
      metadata,
      riskScore: 0,
      riskLevel: "info",
      firstSeen: timestamp,
      lastSeen: timestamp,
    };

    graph.nodes.set(nodeId, node);
  }
}

/**
 * Add data type node for sensitive data
 */
function addDataTypeNode(
  graph: SecurityGraph,
  dataType: DataClassification,
  domain: string,
  timestamp: number
): void {
  const nodeId = `data_type:${dataType}`;

  if (!graph.nodes.has(nodeId)) {
    const metadata: DataTypeMetadata = {
      type: "data_type",
      dataType,
      occurrences: 1,
      domains: [domain],
    };

    const node: GraphNode = {
      id: nodeId,
      type: "data_type",
      label: dataType,
      metadata,
      riskScore: calculateDataTypeRisk(dataType),
      riskLevel: scoreToRiskLevel(calculateDataTypeRisk(dataType)),
      firstSeen: timestamp,
      lastSeen: timestamp,
    };

    graph.nodes.set(nodeId, node);
  } else {
    const node = graph.nodes.get(nodeId)!;
    const metadata = node.metadata as DataTypeMetadata;
    metadata.occurrences++;
    if (!metadata.domains.includes(domain)) {
      metadata.domains.push(domain);
    }
    node.lastSeen = timestamp;
  }

  // Create edge from domain to data type
  const domainNodeId = `domain:${domain}`;
  const edgeId = `${domainNodeId}:sends_data:${nodeId}`;

  if (!graph.edges.has(edgeId)) {
    const edge: GraphEdge = {
      id: edgeId,
      type: "sends_data",
      source: domainNodeId,
      target: nodeId,
      weight: 1,
      riskScore: calculateDataTypeRisk(dataType),
      riskLevel: scoreToRiskLevel(calculateDataTypeRisk(dataType)),
      metadata: {
        dataTypes: [dataType],
      },
      firstSeen: timestamp,
      lastSeen: timestamp,
    };
    graph.edges.set(edgeId, edge);
  } else {
    const edge = graph.edges.get(edgeId)!;
    edge.weight++;
    edge.lastSeen = timestamp;
  }
}

function calculateDataTypeRisk(dataType: DataClassification): number {
  const risks: Record<DataClassification, number> = {
    credentials: 80,
    financial: 75,
    health: 70,
    pii: 60,
    internal: 50,
    code: 30,
    unknown: 10,
  };
  return risks[dataType];
}

/**
 * Update graph statistics
 */
function updateGraphStats(graph: SecurityGraph): void {
  const stats = createEmptyStats();

  for (const node of graph.nodes.values()) {
    stats.totalNodes++;
    stats.nodesByType[node.type]++;
    stats.riskDistribution[node.riskLevel]++;
  }

  for (const edge of graph.edges.values()) {
    stats.totalEdges++;
    stats.edgesByType[edge.type]++;
  }

  graph.stats = stats;
  graph.lastUpdated = Date.now();
}

/**
 * Find attack paths (chains of high-risk nodes/edges)
 */
function findAttackPaths(graph: SecurityGraph): AttackPath[] {
  const paths: AttackPath[] = [];

  // Find paths: NRD/Typosquat domain -> AI Provider with sensitive data
  for (const node of graph.nodes.values()) {
    if (node.type === "domain") {
      const metadata = node.metadata as DomainMetadata;
      if (metadata.isNRD || metadata.isTyposquat) {
        // Check if this domain sends data to AI
        for (const edge of graph.edges.values()) {
          if (edge.source === node.id && edge.type === "ai_prompt") {
            if (edge.metadata.hasCredentials || edge.metadata.hasPII) {
              paths.push({
                id: `path:${node.id}:${edge.target}`,
                name: "Suspicious Domain Data Exfiltration",
                description: `${
                  metadata.isNRD ? "NRD" : "Typosquat"
                } domain sending sensitive data to AI provider`,
                nodes: [node.id, edge.target],
                edges: [edge.id],
                totalRiskScore: node.riskScore + edge.riskScore,
                riskLevel: "critical",
              });
            }
          }
        }
      }
    }
  }

  // Find paths: Extension -> Multiple domains (potential data harvesting)
  for (const node of graph.nodes.values()) {
    if (node.type === "extension") {
      const metadata = node.metadata as ExtensionMetadata;
      if (metadata.uniqueDomains > 10 || metadata.requestCount > 100) {
        const connectedEdges = Array.from(graph.edges.values()).filter(
          (e) => e.source === node.id
        );
        const targetNodes = connectedEdges.map((e) => e.target);

        if (connectedEdges.length > 5) {
          paths.push({
            id: `path:ext:${node.id}`,
            name: "Extension Data Harvesting",
            description: `Extension "${metadata.extensionName}" making requests to ${connectedEdges.length} domains`,
            nodes: [node.id, ...targetNodes.slice(0, 5)],
            edges: connectedEdges.slice(0, 5).map((e) => e.id),
            totalRiskScore: Math.min(100, connectedEdges.length * 5),
            riskLevel: connectedEdges.length > 20 ? "high" : "medium",
          });
        }
      }
    }
  }

  // Sort by risk
  paths.sort((a, b) => riskLevelPriority(b.riskLevel) - riskLevelPriority(a.riskLevel));

  return paths.slice(0, 10); // Top 10 attack paths
}

/**
 * Serialize graph for storage
 */
export function serializeGraph(graph: SecurityGraph): string {
  return JSON.stringify({
    nodes: Array.from(graph.nodes.values()),
    edges: Array.from(graph.edges.values()),
    lastUpdated: graph.lastUpdated,
  });
}

/**
 * Deserialize graph from storage
 */
export function deserializeGraph(json: string): SecurityGraph {
  const data = JSON.parse(json);
  const graph = createSecurityGraph();

  for (const node of data.nodes) {
    graph.nodes.set(node.id, node);
  }

  for (const edge of data.edges) {
    graph.edges.set(edge.id, edge);
  }

  graph.lastUpdated = data.lastUpdated;
  updateGraphStats(graph);

  return graph;
}
