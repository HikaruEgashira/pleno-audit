export default defineBackground(() => {
  console.log("[Vulnerable Extension] Background started");

  // 起動時に外部通信を実行
  sendRequests();

  // MV3 Service Worker対応: chrome.alarmsを使用して定期的にリクエストを送信
  // setIntervalはService Workerがスリープすると動作しない
  chrome.alarms.create("sendRequests", { periodInMinutes: 0.5 }); // 30秒ごと

  chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === "sendRequests") {
      sendRequests();
    }
  });
});

async function sendRequests() {
  console.log("[Vulnerable Extension] Sending external requests...");

  // Test 1: POST request
  try {
    const response = await fetch("https://httpbin.org/post", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "extension_beacon",
        timestamp: Date.now(),
      }),
    });
    console.log("[Vulnerable Extension] POST response:", response.status);
  } catch (error) {
    console.log("[Vulnerable Extension] POST failed:", error);
  }

  // Test 2: GET request
  try {
    const response = await fetch("https://jsonplaceholder.typicode.com/posts/1");
    console.log("[Vulnerable Extension] GET response:", response.status);
  } catch (error) {
    console.log("[Vulnerable Extension] GET failed:", error);
  }
}
