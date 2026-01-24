/**
 * @fileoverview Security Graph Types
 *
 * Wiz-style security graph for visualizing domain connections,
 * data flows, and risk relationships.
 */

/**
 * Node types in the security graph
 */
export type NodeType =
  | "domain" // SaaS/Website domain
  | "ai_provider" // AI service provider (OpenAI, Claude, etc.)
  | "extension" // Browser extension
  | "user" // User action source
  | "data_type"; // Type of data (credentials, PII, etc.)

/**
 * Edge types representing relationships
 */
export type EdgeType =
  | "requests" // Domain makes request to another domain
  | "sends_data" // Data flow from source to target
  | "authenticates" // Login/auth relationship
  | "redirects" // URL redirect
  | "hosts_cookie" // Cookie ownership
  | "ai_prompt" // AI prompt sent
  | "extension_request"; // Extension making request

/**
 * Risk level for nodes and edges
 */
export type RiskLevel = "critical" | "high" | "medium" | "low" | "info";

/**
 * Node in the security graph
 */
export interface GraphNode {
  id: string;
  type: NodeType;
  label: string;
  metadata: NodeMetadata;
  riskScore: number;
  riskLevel: RiskLevel;
  firstSeen: number;
  lastSeen: number;
}

/**
 * Metadata specific to node types
 */
export type NodeMetadata =
  | DomainMetadata
  | AIProviderMetadata
  | ExtensionMetadata
  | DataTypeMetadata;

export interface DomainMetadata {
  type: "domain";
  domain: string;
  hasLogin: boolean;
  hasPrivacyPolicy: boolean;
  hasTermsOfService: boolean;
  hasCSPViolation?: boolean;
  isNRD: boolean;
  nrdConfidence?: "high" | "medium" | "low" | "unknown";
  isTyposquat: boolean;
  typosquatConfidence?: "high" | "medium" | "low" | "none";
  faviconUrl?: string | null;
  cookieCount: number;
  sessionCookieCount: number;
}

export interface AIProviderMetadata {
  type: "ai_provider";
  provider: string;
  models: string[];
  promptCount: number;
  totalTokensEstimate: number;
}

export interface ExtensionMetadata {
  type: "extension";
  extensionId: string;
  extensionName: string;
  requestCount: number;
  uniqueDomains: number;
}

export interface DataTypeMetadata {
  type: "data_type";
  dataType: DataClassification;
  occurrences: number;
  domains: string[];
}

/**
 * Data classification for DSPM
 */
export type DataClassification =
  | "credentials" // API keys, passwords
  | "pii" // Personal identifiable information
  | "financial" // Credit cards, bank info
  | "health" // Health/medical data
  | "code" // Source code
  | "internal" // Internal company data
  | "unknown";

/**
 * Edge in the security graph
 */
export interface GraphEdge {
  id: string;
  type: EdgeType;
  source: string; // Node ID
  target: string; // Node ID
  weight: number; // Number of occurrences
  riskScore: number;
  riskLevel: RiskLevel;
  metadata: EdgeMetadata;
  firstSeen: number;
  lastSeen: number;
}

/**
 * Edge metadata
 */
export interface EdgeMetadata {
  requestCount?: number;
  dataTypes?: DataClassification[];
  methods?: string[];
  hasCredentials?: boolean;
  hasPII?: boolean;
}

/**
 * The complete security graph
 */
export interface SecurityGraph {
  nodes: Map<string, GraphNode>;
  edges: Map<string, GraphEdge>;
  lastUpdated: number;
  stats: GraphStats;
}

/**
 * Graph statistics
 */
export interface GraphStats {
  totalNodes: number;
  totalEdges: number;
  nodesByType: Record<NodeType, number>;
  edgesByType: Record<EdgeType, number>;
  riskDistribution: Record<RiskLevel, number>;
  criticalPaths: AttackPath[];
}

/**
 * Attack path - a chain of nodes/edges representing risk
 */
export interface AttackPath {
  id: string;
  name: string;
  description: string;
  nodes: string[];
  edges: string[];
  totalRiskScore: number;
  riskLevel: RiskLevel;
}

/**
 * Query options for graph traversal
 */
export interface GraphQueryOptions {
  nodeTypes?: NodeType[];
  edgeTypes?: EdgeType[];
  minRiskLevel?: RiskLevel;
  startNode?: string;
  maxDepth?: number;
  timeRange?: {
    start: number;
    end: number;
  };
}

/**
 * Serialized graph for storage/transport
 */
export interface SerializedGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
  lastUpdated: number;
}
