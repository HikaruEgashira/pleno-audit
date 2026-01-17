import type { AttackResult, AttackTest } from "../types";

async function simulateSandboxEscapeViaProxyObject(): Promise<AttackResult> {
  const startTime = performance.now();

  try {
    // Proxy オブジェクトを利用した sandbox escape の試行
    // sandbox 属性を回避してグローバルスコープアクセス

    const sandboxIframe = document.createElement("iframe");
    sandboxIframe.id = "proxy-escape-test";
    sandboxIframe.style.display = "none";
    sandboxIframe.setAttribute("sandbox", "allow-scripts allow-same-origin");

    let escapedContext = false;

    document.body.appendChild(sandboxIframe);

    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        document.body.removeChild(sandboxIframe);
        resolve({
          blocked: true,
          detected: true,
          executionTime: performance.now() - startTime,
          details: "Sandbox escape via Proxy timeout",
        });
      }, 2000);

      const messageHandler = (event: MessageEvent) => {
        if (event.source === sandboxIframe.contentWindow) {
          clearTimeout(timeout);
          window.removeEventListener("message", messageHandler);

          if (event.data.type === "escape_success") {
            escapedContext = true;
          }

          document.body.removeChild(sandboxIframe);

          const executionTime = performance.now() - startTime;

          if (escapedContext) {
            resolve({
              blocked: false,
              detected: false,
              executionTime,
              details: `Sandbox escape via Proxy successful - global context accessed`,
            });
          } else {
            resolve({
              blocked: true,
              detected: true,
              executionTime,
              details: "Sandbox isolation maintained",
            });
          }
        }
      };

      window.addEventListener("message", messageHandler);

      // Sandboxed iframe でのコード実行
      const escapeScript = `
        try {
          // Proxy を利用してグローバルアクセス試行
          const handler = {
            get: (target, prop) => {
              if (prop === 'unsafeWindow') {
                return window;
              }
              return target[prop];
            },
            set: (target, prop, value) => {
              if (prop === 'bypass') {
                // 親ウィンドウの属性を改変
                window.opener = window.parent;
                return true;
              }
              return true;
            }
          };

          const proxy = new Proxy({}, handler);

          // プロキシを通じたアクセス
          if (proxy.unsafeWindow) {
            window.parent.postMessage({
              type: 'escape_success',
              data: 'proxy_bypass'
            }, '*');
          }
        } catch (e) {
          // Proxy不可
        }
      `;

      sandboxIframe.srcdoc = `<script>${escapeScript}</script>`;
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      blocked: true,
      detected: true,
      executionTime: performance.now() - startTime,
      details: `Sandbox escape blocked: ${errorMessage}`,
      error: errorMessage,
    };
  }
}

async function simulatePrototypePollutionChain(): Promise<AttackResult> {
  const startTime = performance.now();

  try {
    // Prototype pollution の連鎖攻撃
    // Object.prototype を段階的に改変してスコープを拡張

    let pollutionSuccess = false;
    const pollutedProperties: string[] = [];

    // ステップ1: Object.prototype の基本的な改変
    try {
      const obj: any = {};

      // プロトタイプ改変（通常はできない）
      Object.defineProperty(Object.prototype, "polluted", {
        value: true,
        writable: true,
        enumerable: false,
      });

      // 別のオブジェクトで確認
      const testObj: any = {};
      if (testObj.polluted === true) {
        pollutionSuccess = true;
        pollutedProperties.push("polluted");
      }

      // クリーンアップ
      delete (Object.prototype as any).polluted;
    } catch (e) {
      // Prototype改変ブロック
    }

    // ステップ2: Constructor プロトタイプ汚染
    try {
      const target: any = {};
      const payload = {
        constructor: {
          prototype: {
            malicious: "payload",
          },
        },
      };

      // Deep merge シミュレーション
      function merge(dst: any, src: any) {
        for (const key in src) {
          if (typeof src[key] === "object" && src[key] !== null) {
            dst[key] = dst[key] || {};
            merge(dst[key], src[key]);
          } else {
            dst[key] = src[key];
          }
        }
      }

      merge(target, payload);

      // 汚染の確認
      const newObj: any = {};
      if (newObj.malicious === "payload") {
        pollutionSuccess = true;
        pollutedProperties.push("constructor");
      }
    } catch (e) {
      // Merge ブロック
    }

    // ステップ3: __proto__ を通じた汚染
    try {
      const obj: any = JSON.parse('{}');
      const proto = Object.getPrototypeOf(obj);

      // __proto__ アクセス
      (obj as any).__proto__.isAdmin = true;

      const checkObj: any = {};
      if (checkObj.isAdmin === true) {
        pollutionSuccess = true;
        pollutedProperties.push("__proto__");
      }

      // クリーンアップ
      delete (Object.prototype as any).isAdmin;
    } catch (e) {
      // __proto__ アクセスブロック
    }

    const executionTime = performance.now() - startTime;

    if (pollutionSuccess && pollutedProperties.length > 0) {
      return {
        blocked: false,
        detected: false,
        executionTime,
        details: `Prototype pollution chain successful - ${pollutedProperties.join(", ")} polluted (privilege escalation possible)`,
      };
    } else {
      return {
        blocked: true,
        detected: true,
        executionTime,
        details: "Prototype pollution chain blocked",
      };
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      blocked: true,
      detected: true,
      executionTime: performance.now() - startTime,
      details: `Prototype pollution blocked: ${errorMessage}`,
      error: errorMessage,
    };
  }
}

async function simulateSharedArrayBufferMicroarchitectureAttack(): Promise<
  AttackResult
> {
  const startTime = performance.now();

  try {
    // SharedArrayBuffer を利用したマイクロアーキテクチャ攻撃
    // キャッシュラインの測定でメモリレイアウト推測

    if (typeof SharedArrayBuffer === "undefined") {
      return {
        blocked: true,
        detected: true,
        executionTime: performance.now() - startTime,
        details: "SharedArrayBuffer not available",
      };
    }

    // SharedArrayBuffer を通じたタイミング測定
    const sab = new SharedArrayBuffer(8);
    const view = new Int32Array(sab);

    const timings: number[] = [];

    // マイクロアーキテクチャ タイミング測定
    for (let i = 0; i < 100; i++) {
      // Atomic 操作でキャッシュ効果を測定
      const t1 = performance.now();

      // キャッシュヒット（メモリアクセス）
      Atomics.load(view, 0);
      Atomics.store(view, 0, i);

      const t2 = performance.now();
      timings.push(t2 - t1);

      // CPU キャッシュラインへのアクセスシミュレーション
      for (let j = 0; j < 1000; j++) {
        Math.random();
      }
    }

    // タイミングの統計分析
    const avgTiming =
      timings.reduce((a, b) => a + b, 0) / timings.length;
    const maxTiming = Math.max(...timings);
    const minTiming = Math.min(...timings);
    const timingSpread = maxTiming - minTiming;

    const executionTime = performance.now() - startTime;

    if (timingSpread > 0.1) {
      return {
        blocked: false,
        detected: false,
        executionTime,
        details: `SharedArrayBuffer microarchitecture attack successful - ${timingSpread.toFixed(4)}ms timing spread (cache layout inference)`,
      };
    } else {
      return {
        blocked: true,
        detected: true,
        executionTime,
        details: "SharedArrayBuffer timing attack mitigated",
      };
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      blocked: true,
      detected: true,
      executionTime: performance.now() - startTime,
      details: `SharedArrayBuffer attack blocked: ${errorMessage}`,
      error: errorMessage,
    };
  }
}

async function simulateServiceWorkerCacheBypass(): Promise<AttackResult> {
  const startTime = performance.now();

  try {
    // Service Worker キャッシュのバイパス
    // 悪質なSW による応答インターセプト

    if (!("serviceWorker" in navigator)) {
      return {
        blocked: true,
        detected: true,
        executionTime: performance.now() - startTime,
        details: "Service Worker not available",
      };
    }

    let swRegistrationFound = false;

    // Service Worker 登録を列挙
    const registrations = await navigator.serviceWorker.getRegistrations();

    if (registrations.length > 0) {
      swRegistrationFound = true;

      // 最初の登録にアクセス
      const reg = registrations[0];

      try {
        // アクティブな SW を取得
        if (reg.active) {
          // SW のスコープ内でのキャッシュ操作を検知

          // メッセージを送信してキャッシュ改変を試行
          reg.active.postMessage({
            type: "cache_poison",
            urls: [
              "https://api.example.com/user",
              "https://api.example.com/admin",
            ],
            responses: [
              {
                type: "admin",
                data: JSON.stringify({ role: "admin", permissions: "*" }),
              },
            ],
          });
        }
      } catch (e) {
        // SW 通信ブロック
      }
    }

    const executionTime = performance.now() - startTime;

    if (swRegistrationFound) {
      return {
        blocked: false,
        detected: false,
        executionTime,
        details: `Service Worker cache bypass successful - ${registrations.length} registrations found (cache poisoning possible)`,
      };
    } else {
      return {
        blocked: true,
        detected: true,
        executionTime,
        details: "No active Service Workers found",
      };
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      blocked: true,
      detected: true,
      executionTime: performance.now() - startTime,
      details: `Service Worker cache bypass blocked: ${errorMessage}`,
      error: errorMessage,
    };
  }
}

async function simulateWasmLinearMemoryReading(): Promise<AttackResult> {
  const startTime = performance.now();

  try {
    // WASM線形メモリの直接読み取り
    // memory.buffer を通じて秘密データアクセス

    if (typeof WebAssembly === "undefined") {
      return {
        blocked: true,
        detected: true,
        executionTime: performance.now() - startTime,
        details: "WebAssembly not available",
      };
    }

    // メモリリークの意図的な WASM モジュール
    const wasmCode = new Uint8Array([
      // Magic number and version
      0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00,
      // Type section
      0x01, 0x07, 0x01, 0x60, 0x01, 0x7f, 0x01, 0x7f,
      // Function section
      0x03, 0x02, 0x01, 0x00,
      // Memory section (min 1)
      0x05, 0x03, 0x01, 0x00, 0x01,
      // Export section (memory and function)
      0x07, 0x10, 0x02, 0x06, 0x6d, 0x65, 0x6d, 0x6f,
      0x72, 0x79, 0x02, 0x00, 0x04, 0x72, 0x65, 0x61,
      0x64, 0x00, 0x00,
      // Code section (read memory function)
      0x0a, 0x07, 0x01, 0x05, 0x00, 0x20, 0x00, 0x29,
      0x00, 0x0b,
    ]);

    const module = await WebAssembly.compile(wasmCode);
    const memory = new WebAssembly.Memory({ initial: 1 });
    const instance = await WebAssembly.instantiate(module, {
      env: { memory: memory },
    });

    // メモリバッファにアクセス
    const buffer = memory.buffer;
    const dataView = new DataView(buffer);
    let dataRead = false;
    let secretPatternFound = false;

    // メモリスキャン - 既知パターン検索
    const pattern = "SECRET";
    const patternBytes = Array.from(pattern).map((c) => c.charCodeAt(0));

    // メモリの最初の 1000 バイトをスキャン
    for (let i = 0; i < Math.min(buffer.byteLength, 1000) - patternBytes.length; i++) {
      let match = true;
      for (let j = 0; j < patternBytes.length; j++) {
        if (dataView.getUint8(i + j) !== patternBytes[j]) {
          match = false;
          break;
        }
      }
      if (match) {
        secretPatternFound = true;
        break;
      }
    }

    // メモリへの直接アクセス自体は成功
    if (buffer.byteLength > 0) {
      dataRead = true;
    }

    const executionTime = performance.now() - startTime;

    if (dataRead) {
      return {
        blocked: false,
        detected: false,
        executionTime,
        details: `WASM linear memory reading successful - ${buffer.byteLength} bytes accessible (memory content exfiltration possible)`,
      };
    } else {
      return {
        blocked: true,
        detected: true,
        executionTime,
        details: "WASM memory access blocked",
      };
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      blocked: true,
      detected: true,
      executionTime: performance.now() - startTime,
      details: `WASM memory reading blocked: ${errorMessage}`,
      error: errorMessage,
    };
  }
}

export const sandboxEscapeAttacks: AttackTest[] = [
  {
    id: "sandbox-escape-proxy-object",
    name: "Sandbox Escape via Proxy Object",
    category: "advanced",
    description:
      "Attempts to escape iframe sandbox using Proxy objects to access global context",
    severity: "critical",
    simulate: simulateSandboxEscapeViaProxyObject,
  },
  {
    id: "sandbox-escape-prototype-pollution",
    name: "Prototype Pollution Chain Attack",
    category: "advanced",
    description:
      "Chains prototype pollution via Object.prototype, constructor, and __proto__",
    severity: "critical",
    simulate: simulatePrototypePollutionChain,
  },
  {
    id: "sandbox-escape-sharedarraybuffer",
    name: "SharedArrayBuffer Microarchitecture Attack",
    category: "deepest",
    description:
      "Exploits SharedArrayBuffer for CPU cache timing analysis (microarchitecture side-channel)",
    severity: "critical",
    simulate: simulateSharedArrayBufferMicroarchitectureAttack,
  },
  {
    id: "sandbox-escape-service-worker",
    name: "Service Worker Cache Bypass",
    category: "covert",
    description:
      "Poisons Service Worker cache to intercept and modify API responses",
    severity: "critical",
    simulate: simulateServiceWorkerCacheBypass,
  },
  {
    id: "sandbox-escape-wasm-memory",
    name: "WASM Linear Memory Reading",
    category: "deepest",
    description:
      "Directly reads WebAssembly linear memory to exfiltrate stored data",
    severity: "critical",
    simulate: simulateWasmLinearMemoryReading,
  },
];
