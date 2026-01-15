// Popup script for Vulnerable Test Extension

const logEl = document.getElementById("log");

function log(message) {
  const entry = document.createElement("div");
  entry.className = "log-entry";
  entry.textContent = `${new Date().toLocaleTimeString()}: ${message}`;
  logEl.appendChild(entry);
  logEl.scrollTop = logEl.scrollHeight;
}

// Fetch request from popup
document.getElementById("fetchBtn").addEventListener("click", async () => {
  log("Sending Fetch request...");
  try {
    const response = await fetch("https://httpbin.org/post", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        source: "popup",
        timestamp: Date.now(),
      }),
    });
    log(`Fetch response: ${response.status}`);
  } catch (error) {
    log(`Fetch error: ${error.message}`);
  }
});

// XHR request from popup
document.getElementById("xhrBtn").addEventListener("click", () => {
  log("Sending XHR request...");
  const xhr = new XMLHttpRequest();
  xhr.open("GET", "https://jsonplaceholder.typicode.com/posts/1", true);
  xhr.onload = () => {
    log(`XHR response: ${xhr.status}`);
  };
  xhr.onerror = () => {
    log("XHR error");
  };
  xhr.send();
});

// WebSocket from popup
document.getElementById("wsBtn").addEventListener("click", () => {
  log("Opening WebSocket...");
  try {
    const ws = new WebSocket("wss://echo.websocket.org");
    ws.onopen = () => {
      log("WebSocket connected");
      ws.send("test from popup");
    };
    ws.onmessage = (e) => {
      log(`WebSocket message: ${e.data}`);
    };
    ws.onerror = () => {
      log("WebSocket error");
    };
    ws.onclose = () => {
      log("WebSocket closed");
    };
  } catch (error) {
    log(`WebSocket error: ${error.message}`);
  }
});

// Bulk requests
document.getElementById("bulkBtn").addEventListener("click", async () => {
  log("Sending 10 bulk requests...");
  const endpoints = [
    "https://httpbin.org/get",
    "https://httpbin.org/post",
    "https://jsonplaceholder.typicode.com/posts/1",
    "https://jsonplaceholder.typicode.com/users/1",
    "https://jsonplaceholder.typicode.com/todos/1",
  ];

  for (let i = 0; i < 10; i++) {
    const url = endpoints[i % endpoints.length];
    try {
      const response = await fetch(url);
      log(`Request ${i + 1}: ${response.status}`);
    } catch (error) {
      log(`Request ${i + 1} failed`);
    }
  }
  log("Bulk requests completed");
});

log("Popup loaded");
