import { describe, expect, it, vi } from "vitest";
import { createNetworkSecurityInspector } from "./network-security-inspector";

describe("createNetworkSecurityInspector", () => {
  it("閾値超過でデータ漏洩判定を返す", async () => {
    const handleDataExfiltration = vi.fn(async () => ({ success: true }));
    const handleTrackingBeacon = vi.fn(async () => ({ success: true }));
    const inspector = createNetworkSecurityInspector({
      handleDataExfiltration,
      handleTrackingBeacon,
    });

    const result = await inspector.handleNetworkInspection({
      pageUrl: "https://example.com/page",
      url: "/api/upload",
      method: "POST",
      initiator: "fetch",
      bodySize: 12 * 1024,
      bodySample: "",
      timestamp: 1700000000000,
    }, {} as chrome.runtime.MessageSender);

    expect(result.success).toBe(true);
    expect(result.detected).toBe(1);
    expect(handleDataExfiltration).toHaveBeenCalledTimes(1);
    expect(handleTrackingBeacon).not.toHaveBeenCalled();
    expect(handleDataExfiltration.mock.calls[0][0]).toMatchObject({
      targetUrl: "https://example.com/api/upload",
      targetDomain: "example.com",
      method: "POST",
      bodySize: 12 * 1024,
    });
  });

  it("機密文字列でデータ漏洩判定を返す", async () => {
    const handleDataExfiltration = vi.fn(async () => ({ success: true }));
    const handleTrackingBeacon = vi.fn(async () => ({ success: true }));
    const inspector = createNetworkSecurityInspector({
      handleDataExfiltration,
      handleTrackingBeacon,
    });

    const result = await inspector.handleNetworkInspection({
      pageUrl: "https://example.com",
      url: "https://api.example.net/submit",
      method: "POST",
      initiator: "xhr",
      bodySize: 512,
      bodySample: "{\"password\":\"secret123\"}",
      timestamp: 1700000001000,
    }, {} as chrome.runtime.MessageSender);

    expect(result.success).toBe(true);
    expect(result.detected).toBe(1);
    expect(handleDataExfiltration).toHaveBeenCalledTimes(1);
    expect(handleTrackingBeacon).not.toHaveBeenCalled();
    expect(handleDataExfiltration.mock.calls[0][0]).toMatchObject({
      targetDomain: "api.example.net",
      sensitiveDataTypes: ["password"],
    });
  });

  it("tracking beacon を判定する", async () => {
    const handleDataExfiltration = vi.fn(async () => ({ success: true }));
    const handleTrackingBeacon = vi.fn(async () => ({ success: true }));
    const inspector = createNetworkSecurityInspector({
      handleDataExfiltration,
      handleTrackingBeacon,
    });

    const result = await inspector.handleNetworkInspection({
      pageUrl: "https://example.com",
      url: "https://analytics.example.net/collect",
      method: "POST",
      initiator: "sendBeacon",
      bodySize: 128,
      bodySample: "{\"event\":\"pageview\"}",
      timestamp: 1700000002000,
    }, {} as chrome.runtime.MessageSender);

    expect(result.success).toBe(true);
    expect(result.detected).toBe(1);
    expect(handleTrackingBeacon).toHaveBeenCalledTimes(1);
    expect(handleDataExfiltration).not.toHaveBeenCalled();
    expect(handleTrackingBeacon.mock.calls[0][0]).toMatchObject({
      url: "https://analytics.example.net/collect",
      targetDomain: "analytics.example.net",
    });
  });

  it("GET は検査しても検知しない", async () => {
    const handleDataExfiltration = vi.fn(async () => ({ success: true }));
    const handleTrackingBeacon = vi.fn(async () => ({ success: true }));
    const inspector = createNetworkSecurityInspector({
      handleDataExfiltration,
      handleTrackingBeacon,
    });

    const result = await inspector.handleNetworkInspection({
      pageUrl: "https://example.com",
      url: "/api/data",
      method: "GET",
      initiator: "fetch",
      bodySize: 0,
    }, {} as chrome.runtime.MessageSender);

    expect(result).toEqual({ success: true, detected: 0 });
    expect(handleDataExfiltration).not.toHaveBeenCalled();
    expect(handleTrackingBeacon).not.toHaveBeenCalled();
  });

  it("不正な payload は失敗を返す", async () => {
    const inspector = createNetworkSecurityInspector({
      handleDataExfiltration: async () => ({ success: true }),
      handleTrackingBeacon: async () => ({ success: true }),
    });

    const result = await inspector.handleNetworkInspection(null, {} as chrome.runtime.MessageSender);
    expect(result).toEqual({ success: false, reason: "invalid_data" });
  });
});
