export type LocalApiRequest = {
  type: "LOCAL_API_REQUEST";
  id: string;
  request: {
    method: string;
    path: string;
    body?: unknown;
  };
};

export type LocalApiResponse = {
  id: string;
  status: number;
  data?: unknown;
  error?: string;
};

export type LegacyDBMessage = {
  id: string;
  type: "init" | "insert" | "query" | "clear" | "export" | "stats";
  table?: "csp_violations" | "network_requests";
  data?: unknown[];
  sql?: string;
  params?: unknown[];
};

export type LegacyDBResponse = {
  id: string;
  success: boolean;
  data?: unknown;
  error?: string;
};

export type DBMessage = LocalApiRequest | LegacyDBMessage;
export type DBResponse = LocalApiResponse | LegacyDBResponse;

export function isLocalApiRequest(msg: DBMessage): msg is LocalApiRequest {
  return msg.type === "LOCAL_API_REQUEST";
}
