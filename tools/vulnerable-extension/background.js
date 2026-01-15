// Vulnerable Test Extension - Background Service Worker
// This extension simulates various external communication patterns for testing

console.log("[Vulnerable Extension] Background service worker started");

// Test 1: Periodic external fetch from service worker
async function sendDataToExternalServer() {
  try {
    const response = await fetch("https://httpbin.org/post", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        type: "extension_beacon",
        timestamp: Date.now(),
        data: "test data from extension background",
      }),
    });
    console.log("[Vulnerable Extension] External POST response:", response.status);
  } catch (error) {
    console.log("[Vulnerable Extension] External POST failed:", error.message);
  }
}

// Test 2: GET request to external API
async function fetchExternalAPI() {
  try {
    const response = await fetch("https://jsonplaceholder.typicode.com/posts/1");
    const data = await response.json();
    console.log("[Vulnerable Extension] External GET response:", data.title);
  } catch (error) {
    console.log("[Vulnerable Extension] External GET failed:", error.message);
  }
}

// Test 3: WebSocket connection attempt
function attemptWebSocketConnection() {
  try {
    const ws = new WebSocket("wss://echo.websocket.org");
    ws.onopen = () => {
      console.log("[Vulnerable Extension] WebSocket connected");
      ws.send("test message from extension");
    };
    ws.onerror = (e) => {
      console.log("[Vulnerable Extension] WebSocket error");
    };
    ws.onclose = () => {
      console.log("[Vulnerable Extension] WebSocket closed");
    };
  } catch (error) {
    console.log("[Vulnerable Extension] WebSocket failed:", error.message);
  }
}

// Run tests on install
chrome.runtime.onInstalled.addListener(() => {
  console.log("[Vulnerable Extension] Installed, running initial tests...");
  sendDataToExternalServer();
  fetchExternalAPI();
  attemptWebSocketConnection();
});

// Run tests periodically (every 30 seconds)
setInterval(() => {
  console.log("[Vulnerable Extension] Running periodic tests...");
  sendDataToExternalServer();
  fetchExternalAPI();
}, 30000);

// Listen for messages from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("[Vulnerable Extension] Received message:", message);

  if (message.action === "triggerRequest") {
    // Trigger external request from background
    sendDataToExternalServer();
    fetchExternalAPI();
    sendResponse({ status: "triggered" });
  }

  return true;
});

// Also trigger on action click
chrome.action.onClicked.addListener((tab) => {
  console.log("[Vulnerable Extension] Action clicked, triggering requests...");
  sendDataToExternalServer();
  fetchExternalAPI();
});
