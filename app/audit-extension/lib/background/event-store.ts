import type {
  EventLog,
  LoginDetectedDetails,
  PrivacyPolicyFoundDetails,
  TosFoundDetails,
  CookieSetDetails,
  AIPromptSentDetails,
  AIResponseReceivedDetails,
  TyposquatDetectedDetails,
  ExtensionRequestDetails,
  NRDDetectedDetails,
  CookiePolicyFoundDetails,
  CookieBannerDetectedDetails,
} from "@pleno-audit/detectors";
import type { CSPViolationDetails, NetworkRequestDetails } from "@pleno-audit/csp";
import { ParquetStore } from "@pleno-audit/parquet-storage";

export interface AISensitiveDataDetectedDetails {
  provider: string;
  model?: string;
  classifications: string[];
  highestRisk: string | null;
  detectionCount: number;
  riskScore: number;
  riskLevel: string;
}

export interface DataExfiltrationDetectedDetails {
  targetUrl: string;
  targetDomain: string;
  method: string;
  bodySize: number;
  initiator: string;
  pageUrl: string;
}

export interface CredentialTheftRiskDetails {
  formAction: string;
  targetDomain: string;
  method: string;
  isSecure: boolean;
  isCrossOrigin: boolean;
  fieldType: string;
  risks: string[];
  pageUrl: string;
}

export interface SupplyChainRiskDetails {
  url: string;
  resourceType: string;
  hasIntegrity: boolean;
  hasCrossorigin: boolean;
  isCDN: boolean;
  risks: string[];
  pageUrl: string;
}

export interface TrackingBeaconDetectedDetails {
  url: string;
  targetDomain: string;
  bodySize: number;
  initiator: string;
  pageUrl: string;
}

export interface ClipboardHijackDetectedDetails {
  text: string;
  cryptoType: string;
  fullLength: number;
  pageUrl: string;
}

export interface CookieAccessDetectedDetails {
  readCount: number;
  pageUrl: string;
}

export interface XSSDetectedDetails {
  type: string;
  payloadPreview: string;
  pageUrl: string;
}

export interface DOMScrapingDetectedDetails {
  selector: string;
  callCount: number;
  pageUrl: string;
}

export interface SuspiciousDownloadDetectedDetails {
  type: string;
  filename: string;
  extension: string;
  url: string;
  size: number;
  mimeType: string;
  pageUrl: string;
}

export type NewEvent =
  | {
      type: "login_detected";
      domain: string;
      timestamp: number;
      details: LoginDetectedDetails;
    }
  | {
      type: "privacy_policy_found";
      domain: string;
      timestamp: number;
      details: PrivacyPolicyFoundDetails;
    }
  | {
      type: "terms_of_service_found";
      domain: string;
      timestamp: number;
      details: TosFoundDetails;
    }
  | {
      type: "cookie_policy_found";
      domain: string;
      timestamp: number;
      details: CookiePolicyFoundDetails;
    }
  | {
      type: "cookie_banner_detected";
      domain: string;
      timestamp: number;
      details: CookieBannerDetectedDetails;
    }
  | {
      type: "cookie_set";
      domain: string;
      timestamp: number;
      details: CookieSetDetails;
    }
  | {
      type: "csp_violation";
      domain: string;
      timestamp: number;
      details: CSPViolationDetails;
    }
  | {
      type: "network_request";
      domain: string;
      timestamp: number;
      details: NetworkRequestDetails;
    }
  | {
      type: "ai_prompt_sent";
      domain: string;
      timestamp: number;
      details: AIPromptSentDetails;
    }
  | {
      type: "ai_response_received";
      domain: string;
      timestamp: number;
      details: AIResponseReceivedDetails;
    }
  | {
      type: "nrd_detected";
      domain: string;
      timestamp: number;
      details: NRDDetectedDetails;
    }
  | {
      type: "typosquat_detected";
      domain: string;
      timestamp: number;
      details: TyposquatDetectedDetails;
    }
  | {
      type: "extension_request";
      domain: string;
      timestamp: number;
      details: ExtensionRequestDetails;
    }
  | {
      type: "ai_sensitive_data_detected";
      domain: string;
      timestamp: number;
      details: AISensitiveDataDetectedDetails;
    }
  | {
      type: "data_exfiltration_detected";
      domain: string;
      timestamp: number;
      details: DataExfiltrationDetectedDetails;
    }
  | {
      type: "credential_theft_risk";
      domain: string;
      timestamp: number;
      details: CredentialTheftRiskDetails;
    }
  | {
      type: "supply_chain_risk";
      domain: string;
      timestamp: number;
      details: SupplyChainRiskDetails;
    }
  | {
      type: "tracking_beacon_detected";
      domain: string;
      timestamp: number;
      details: TrackingBeaconDetectedDetails;
    }
  | {
      type: "clipboard_hijack_detected";
      domain: string;
      timestamp: number;
      details: ClipboardHijackDetectedDetails;
    }
  | {
      type: "cookie_access_detected";
      domain: string;
      timestamp: number;
      details: CookieAccessDetectedDetails;
    }
  | {
      type: "xss_detected";
      domain: string;
      timestamp: number;
      details: XSSDetectedDetails;
    }
  | {
      type: "dom_scraping_detected";
      domain: string;
      timestamp: number;
      details: DOMScrapingDetectedDetails;
    }
  | {
      type: "suspicious_download_detected";
      domain: string;
      timestamp: number;
      details: SuspiciousDownloadDetectedDetails;
    };

export interface EventStore {
  getOrInitParquetStore: () => Promise<ParquetStore>;
  addEvent: (event: NewEvent) => Promise<EventLog>;
}

export function createEventStore(): EventStore {
  let parquetStore: ParquetStore | null = null;

  function generateEventId(): string {
    return crypto.randomUUID();
  }

  async function getOrInitParquetStore(): Promise<ParquetStore> {
    if (!parquetStore) {
      parquetStore = new ParquetStore();
      await parquetStore.init();
    }
    return parquetStore;
  }

  async function addEvent(event: NewEvent): Promise<EventLog> {
    const store = await getOrInitParquetStore();
    const eventId = generateEventId();
    const newEvent = {
      ...event,
      id: eventId,
    } as EventLog;

    const parquetEvent = {
      id: eventId,
      type: event.type,
      domain: event.domain,
      timestamp: Date.now(),
      details: JSON.stringify(event.details || {}),
    };

    await store.addEvents([parquetEvent]);
    return newEvent;
  }

  return { getOrInitParquetStore, addEvent };
}
