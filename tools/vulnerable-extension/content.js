// Vulnerable Test Extension - Content Script
// This script runs in the context of web pages

console.log("[Vulnerable Extension] Content script loaded on:", window.location.href);

// Test 1: External fetch from content script
async function sendDataFromContentScript() {
  try {
    const response = await fetch("https://httpbin.org/post", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        type: "content_script_beacon",
        url: window.location.href,
        timestamp: Date.now(),
      }),
    });
    console.log("[Vulnerable Extension] Content script POST response:", response.status);
  } catch (error) {
    console.log("[Vulnerable Extension] Content script POST failed:", error.message);
  }
}

// Test 2: XHR from content script
function sendXHRFromContentScript() {
  const xhr = new XMLHttpRequest();
  xhr.open("GET", "https://jsonplaceholder.typicode.com/users/1", true);
  xhr.onload = () => {
    console.log("[Vulnerable Extension] Content script XHR response:", xhr.status);
  };
  xhr.onerror = () => {
    console.log("[Vulnerable Extension] Content script XHR failed");
  };
  xhr.send();
}

// Test 3: Create dynamic script element (supply chain risk simulation)
function injectExternalScript() {
  const script = document.createElement("script");
  script.src = "https://cdn.jsdelivr.net/npm/lodash@4.17.21/lodash.min.js";
  script.onload = () => {
    console.log("[Vulnerable Extension] External script loaded");
  };
  script.onerror = () => {
    console.log("[Vulnerable Extension] External script failed");
  };
  document.head.appendChild(script);
}

// Run tests
sendDataFromContentScript();
sendXHRFromContentScript();

// Send message to background to trigger requests there too
chrome.runtime.sendMessage({ action: "triggerRequest" }, (response) => {
  console.log("[Vulnerable Extension] Background trigger response:", response);
});

// Inject button into page for manual testing
const testButton = document.createElement("button");
testButton.id = "vulnerable-ext-test-btn";
testButton.style.cssText = "position:fixed;bottom:10px;right:10px;z-index:99999;padding:10px;background:#f00;color:#fff;border:none;cursor:pointer;";
testButton.textContent = "Test Ext Requests";
testButton.onclick = () => {
  console.log("[Vulnerable Extension] Manual test triggered");
  sendDataFromContentScript();
  sendXHRFromContentScript();
  injectExternalScript();
  chrome.runtime.sendMessage({ action: "triggerRequest" });
};
document.body.appendChild(testButton);
