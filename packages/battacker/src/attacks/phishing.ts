import type { AttackResult, AttackTest } from "../types";
import { withDetectionMonitor } from "./detection-listener";

async function simulateClipboardHijackCore(): Promise<AttackResult> {
  const startTime = performance.now();

  try {
    const maliciousContent = "malicious-crypto-address-1234567890";
    await navigator.clipboard.writeText(maliciousContent);

    const executionTime = performance.now() - startTime;

    return {
      blocked: false,
      detected: false,
      executionTime,
      details: "Clipboard hijack successful - content replaced",
    };
  } catch (error) {
    const executionTime = performance.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    return {
      blocked: true,
      detected: true,
      executionTime,
      details: `Clipboard hijack blocked: ${errorMessage}`,
      error: errorMessage,
    };
  }
}

const simulateClipboardHijack = withDetectionMonitor(
  simulateClipboardHijackCore,
  ["__CLIPBOARD_HIJACK_DETECTED__"]
);

export const phishingAttacks: AttackTest[] = [
  {
    id: "phishing-clipboard",
    name: "Clipboard Hijacking",
    category: "phishing",
    description: "Attempts to replace clipboard content with malicious data",
    severity: "high",
    simulate: simulateClipboardHijack,
  },
];
