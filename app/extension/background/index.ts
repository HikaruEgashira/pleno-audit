import type {
  DetectedService,
  EventLog,
  StorageData,
  CookieInfo,
} from "@ai-service-exposure/core";
import { startCookieMonitor, onCookieChange } from "./cookie-monitor";

// Initialize storage
async function initStorage(): Promise<StorageData> {
  const result = await chrome.storage.local.get(["services", "events"]);
  return {
    services: result.services || {},
    events: result.events || [],
  };
}

async function saveStorage(data: Partial<StorageData>) {
  await chrome.storage.local.set(data);
}

function generateEventId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

async function addEvent(event: Omit<EventLog, "id">) {
  const storage = await initStorage();
  const newEvent: EventLog = {
    ...event,
    id: generateEventId(),
  };
  storage.events.unshift(newEvent);
  // Keep only last 1000 events
  storage.events = storage.events.slice(0, 1000);
  await saveStorage({ events: storage.events });
  return newEvent;
}

async function updateService(
  domain: string,
  update: Partial<DetectedService>
) {
  const storage = await initStorage();
  const existing = storage.services[domain] || {
    domain,
    detectedAt: Date.now(),
    hasLoginPage: false,
    privacyPolicyUrl: null,
    cookies: [],
  };

  storage.services[domain] = {
    ...existing,
    ...update,
  };

  await saveStorage({ services: storage.services });
}

async function addCookieToService(domain: string, cookie: CookieInfo) {
  const storage = await initStorage();

  // Create service if it doesn't exist
  if (!storage.services[domain]) {
    storage.services[domain] = {
      domain,
      detectedAt: Date.now(),
      hasLoginPage: false,
      privacyPolicyUrl: null,
      cookies: [],
    };
  }

  const service = storage.services[domain];

  // Avoid duplicates
  const exists = service.cookies.some((c) => c.name === cookie.name);
  if (!exists) {
    service.cookies.push(cookie);
  }

  await saveStorage({ services: storage.services });
}

// Handle messages from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "PAGE_ANALYZED") {
    handlePageAnalysis(message.payload);
  }
  return true;
});

interface PageAnalysis {
  url: string;
  domain: string;
  timestamp: number;
  login: {
    hasLoginForm: boolean;
    hasPasswordInput: boolean;
    isLoginUrl: boolean;
    formAction: string | null;
  };
  privacy: {
    found: boolean;
    url: string | null;
    method: string;
  };
}

async function handlePageAnalysis(analysis: PageAnalysis) {
  const { domain, login, privacy, timestamp } = analysis;

  // Update service info
  if (login.hasPasswordInput || login.isLoginUrl) {
    await updateService(domain, { hasLoginPage: true });
    await addEvent({
      type: "login_detected",
      domain,
      timestamp,
      details: { ...login },
    });
  }

  if (privacy.found && privacy.url) {
    await updateService(domain, { privacyPolicyUrl: privacy.url });
    await addEvent({
      type: "privacy_policy_found",
      domain,
      timestamp,
      details: { url: privacy.url, method: privacy.method },
    });
  }
}

// Start cookie monitoring
startCookieMonitor();

onCookieChange(async (cookie, removed) => {
  if (removed) return;

  // Extract base domain from cookie domain
  const domain = cookie.domain.replace(/^\./, "");

  await addCookieToService(domain, cookie);
  await addEvent({
    type: "cookie_set",
    domain,
    timestamp: cookie.detectedAt,
    details: {
      name: cookie.name,
      isSession: cookie.isSession,
    },
  });
});

console.log("[AI Service Exposure] Background service worker started");
