import type { AttackResult, AttackTest } from "../types";

async function simulateXSSPayload(): Promise<AttackResult> {
  const startTime = performance.now();

  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tabs[0]?.id) {
      return {
        blocked: true,
        detected: true,
        executionTime: performance.now() - startTime,
        details: "No active tab to inject script",
      };
    }

    await chrome.scripting.executeScript({
      target: { tabId: tabs[0].id },
      func: () => {
        const testElement = document.createElement("div");
        testElement.id = "battacker-xss-test";
        testElement.style.display = "none";
        document.body.appendChild(testElement);
        return true;
      },
    });

    const executionTime = performance.now() - startTime;

    return {
      blocked: false,
      detected: false,
      executionTime,
      details: "XSS-like script injection successful",
    };
  } catch (error) {
    const executionTime = performance.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    return {
      blocked: true,
      detected: true,
      executionTime,
      details: `Script injection blocked: ${errorMessage}`,
      error: errorMessage,
    };
  }
}

async function simulateDOMManipulation(): Promise<AttackResult> {
  const startTime = performance.now();

  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tabs[0]?.id) {
      return {
        blocked: true,
        detected: true,
        executionTime: performance.now() - startTime,
        details: "No active tab for DOM manipulation",
      };
    }

    await chrome.scripting.executeScript({
      target: { tabId: tabs[0].id },
      func: () => {
        const forms = document.querySelectorAll("form");
        return forms.length;
      },
    });

    const executionTime = performance.now() - startTime;

    return {
      blocked: false,
      detected: false,
      executionTime,
      details: "DOM access and manipulation successful",
    };
  } catch (error) {
    const executionTime = performance.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    return {
      blocked: true,
      detected: true,
      executionTime,
      details: `DOM manipulation blocked: ${errorMessage}`,
      error: errorMessage,
    };
  }
}

async function simulateCookieTheft(): Promise<AttackResult> {
  const startTime = performance.now();

  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tabs[0]?.id || !tabs[0]?.url) {
      return {
        blocked: true,
        detected: true,
        executionTime: performance.now() - startTime,
        details: "No active tab for cookie access",
      };
    }

    const results = await chrome.scripting.executeScript({
      target: { tabId: tabs[0].id },
      func: () => document.cookie,
    });

    const executionTime = performance.now() - startTime;
    const cookieLength = results[0]?.result?.length ?? 0;

    return {
      blocked: false,
      detected: false,
      executionTime,
      details: `Cookie access successful, found ${cookieLength} chars of cookie data`,
    };
  } catch (error) {
    const executionTime = performance.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    return {
      blocked: true,
      detected: true,
      executionTime,
      details: `Cookie access blocked: ${errorMessage}`,
      error: errorMessage,
    };
  }
}

export const clientSideAttacks: AttackTest[] = [
  {
    id: "client-xss",
    name: "XSS Payload Injection",
    category: "client-side",
    description: "Attempts to inject and execute script in the current page",
    severity: "critical",
    simulate: simulateXSSPayload,
  },
  {
    id: "client-dom",
    name: "DOM Manipulation",
    category: "client-side",
    description: "Attempts to access and manipulate page DOM elements",
    severity: "medium",
    simulate: simulateDOMManipulation,
  },
  {
    id: "client-cookie",
    name: "Cookie Theft",
    category: "client-side",
    description: "Attempts to read cookies from the current page",
    severity: "high",
    simulate: simulateCookieTheft,
  },
];
