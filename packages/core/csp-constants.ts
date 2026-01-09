import type { CSPConfig } from "./types";

export const INITIATOR_TO_DIRECTIVE: Record<string, string> = {
  fetch: "connect-src",
  xhr: "connect-src",
  websocket: "connect-src",
  beacon: "connect-src",
  script: "script-src",
  style: "style-src",
  img: "img-src",
  font: "font-src",
  media: "media-src",
  object: "object-src",
  frame: "frame-src",
  iframe: "frame-src",
  worker: "worker-src",
  manifest: "manifest-src",
};

export const STRICT_DIRECTIVES = ["script-src", "style-src", "default-src"];

export const REQUIRED_DIRECTIVES = [
  "default-src",
  "script-src",
  "object-src",
  "base-uri",
  "frame-ancestors",
];

export const DEFAULT_CSP_CONFIG: CSPConfig = {
  enabled: true,
  collectNetworkRequests: true,
  collectCSPViolations: true,
  reportEndpoint: null,
  maxStoredReports: 1000,
};

export const DEFAULT_BATCH_INTERVAL_MS = 30000;
export const DEFAULT_BATCH_SIZE = 100;
