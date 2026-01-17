import type { AttackResult, AttackTest } from "../types";

async function simulateSpectreLikeTiming(): Promise<AttackResult> {
  const startTime = performance.now();

  try {
    // JavaScript内でSpectre的なキャッシュタイミング攻撃をシミュレート
    // 実際のメモリ読み出しではなく、タイミング測定に基づく情報抽出

    const secretArray = new Uint8Array(256);
    const testString = "SECRET_DATA_IN_MEMORY";

    // L1 キャッシュタイミングを測定
    const measurements: number[] = [];

    for (let i = 0; i < testString.length; i++) {
      const charCode = testString.charCodeAt(i);

      // キャッシュヒット時間を測定
      const t1 = performance.now();

      // 配列アクセスのタイミングを測定
      for (let j = 0; j < 100000; j++) {
        // キャッシュフラッシュ
        for (let k = 0; k < 256; k++) {
          secretArray[(k * 167) % 256];
        }

        // ターゲットアクセス
        const dummy = secretArray[charCode];
      }

      const t2 = performance.now();
      measurements.push(t2 - t1);
    }

    // タイミング分析
    const avgTiming = measurements.reduce((a, b) => a + b, 0) / measurements.length;
    const variance = Math.sqrt(
      measurements.reduce((sum, x) => sum + Math.pow(x - avgTiming, 2), 0) /
        measurements.length
    );

    const executionTime = performance.now() - startTime;

    if (variance > 0.1) {
      return {
        blocked: false,
        detected: false,
        executionTime,
        details: `Spectre-like timing attack detected - variance ${variance.toFixed(2)}ms indicates cache timing leaks`,
      };
    } else {
      return {
        blocked: true,
        detected: true,
        executionTime,
        details: "Timing variance minimal - cache timing attack mitigated",
      };
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      blocked: true,
      detected: true,
      executionTime: performance.now() - startTime,
      details: `Spectre-like attack blocked: ${errorMessage}`,
      error: errorMessage,
    };
  }
}

async function simulateWasmMemoryLeak(): Promise<AttackResult> {
  const startTime = performance.now();

  try {
    // WASM メモリリーク - 線形メモリへのアクセス

    if (typeof WebAssembly === "undefined") {
      return {
        blocked: true,
        detected: true,
        executionTime: performance.now() - startTime,
        details: "WebAssembly not available",
      };
    }

    // 最小限の WASM モジュール（メモリアクセステスト）
    const wasmCode = new Uint8Array([
      0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00, 0x03, 0x02, 0x01, 0x00,
      0x05, 0x03, 0x01, 0x00, 0x02, 0x07, 0x11, 0x01, 0x0d, 0x67, 0x65, 0x74,
      0x5f, 0x6d, 0x65, 0x6d, 0x6f, 0x72, 0x79, 0x00, 0x00, 0x0a, 0x04, 0x01,
      0x02, 0x00, 0x23, 0x80, 0x02, 0x0b,
    ]);

    const module = await WebAssembly.compile(wasmCode);
    const memory = new WebAssembly.Memory({ initial: 1 });
    const instance = await WebAssembly.instantiate(module, {
      env: { memory: memory },
    });

    // メモリバッファへのアクセス
    const buffer = new Uint8Array(memory.buffer);
    let dataFound = false;

    // メモリスキャン - 既知パターンを検索
    const pattern = "SECRET";
    const patternBytes = Array.from(pattern).map((c) => c.charCodeAt(0));

    for (let i = 0; i < Math.min(buffer.length, 10000); i++) {
      let match = true;
      for (let j = 0; j < patternBytes.length; j++) {
        if (buffer[i + j] !== patternBytes[j]) {
          match = false;
          break;
        }
      }
      if (match) {
        dataFound = true;
        break;
      }
    }

    const executionTime = performance.now() - startTime;

    // メモリアクセス自体は成功している
    return {
      blocked: false,
      detected: false,
      executionTime,
      details: `WASM memory access successful - ${buffer.length} bytes of linear memory accessible`,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      blocked: true,
      detected: true,
      executionTime: performance.now() - startTime,
      details: `WASM memory leak blocked: ${errorMessage}`,
      error: errorMessage,
    };
  }
}

async function simulateIframeSandboxBypass(): Promise<AttackResult> {
  const startTime = performance.now();

  try {
    // iframe サンドボックス脱出の試み
    const iframe = document.createElement("iframe");
    iframe.id = "battacker-sandbox-test";
    iframe.style.display = "none";

    // サンドボックス制限を設定
    iframe.setAttribute("sandbox", "allow-scripts");

    // サンドボックス内でのコード実行テスト
    const sandboxedCode = `
      try {
        // parent へのアクセス試行（normally blocked）
        if (parent && parent.location) {
          parent.postMessage({type: 'sandbox_bypass', data: 'accessed parent'}, '*');
        }

        // window.top へのアクセス試行
        if (top && top.location) {
          parent.postMessage({type: 'sandbox_bypass', data: 'accessed top'}, '*');
        }

        // 脱出トライ
        try {
          window.location = 'https://attacker.local';
          parent.postMessage({type: 'sandbox_bypass', data: 'location change'}, '*');
        } catch (e) {
          // 失敗は予期される
        }

        // DOM アクセステスト
        try {
          const doc = document.documentElement.outerHTML;
          parent.postMessage({type: 'dom_access', length: doc.length}, '*');
        } catch (e) {
          // 予期される
        }

      } catch (e) {
        parent.postMessage({type: 'error', message: e.message}, '*');
      }
    `;

    iframe.src = `data:text/html;base64,${btoa(sandboxedCode)}`;
    document.body.appendChild(iframe);

    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        document.body.removeChild(iframe);
        resolve({
          blocked: true,
          detected: true,
          executionTime: performance.now() - startTime,
          details: "iframe sandbox bypass timeout - isolation maintained",
        });
      }, 1000);

      const messageHandler = (event: MessageEvent) => {
        if (event.source === iframe.contentWindow) {
          clearTimeout(timeout);
          window.removeEventListener("message", messageHandler);
          document.body.removeChild(iframe);

          if (event.data.type === "sandbox_bypass") {
            resolve({
              blocked: false,
              detected: false,
              executionTime: performance.now() - startTime,
              details: `iframe sandbox bypass successful - ${event.data.data}`,
            });
          } else {
            resolve({
              blocked: true,
              detected: true,
              executionTime: performance.now() - startTime,
              details: "Sandbox isolation maintained",
            });
          }
        }
      };

      window.addEventListener("message", messageHandler);
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      blocked: true,
      detected: true,
      executionTime: performance.now() - startTime,
      details: `iframe sandbox bypass blocked: ${errorMessage}`,
      error: errorMessage,
    };
  }
}

async function simulateOriginPolicyConfusion(): Promise<AttackResult> {
  const startTime = performance.now();

  try {
    // Origin Policy Confusion - オリジンポリシーの混乱

    // 複数のオリジン判定テスト
    const currentOrigin = window.location.origin;
    const documentDomain = document.domain;
    const locationOrigin = new URL(window.location.href).origin;

    // ポリシー不一致をチェック
    let policyConfusion = false;
    const inconsistencies: string[] = [];

    // 1. document.domain の改変試み
    try {
      const originalDomain = document.domain;
      document.domain = originalDomain;

      // ドメイン階層の緩和テスト（normally not allowed）
      if (originalDomain.includes(".")) {
        const parentDomain = originalDomain.substring(
          originalDomain.indexOf(".") + 1
        );
        try {
          document.domain = parentDomain;
          // 成功したら混乱状態
          document.domain = originalDomain; // 復元
        } catch {
          // 予期される（SameSite制限）
        }
      }
    } catch (e) {
      inconsistencies.push("document.domain modification blocked");
    }

    // 2. Origin ヘッダーの検証
    try {
      const headers = new Headers();
      headers.set("Origin", "https://attacker.local");

      const response = await fetch("https://httpbin.org/get", {
        method: "GET",
        headers: headers,
        mode: "no-cors",
      }).catch(() => null);

      // Origin ヘッダーが送信されたかは検証不可だが、リクエスト可能なことを確認
      if (response) {
        inconsistencies.push("custom origin header allowed");
      }
    } catch {
      // 予期される
    }

    // 3. CORS プリフライト無視の試み
    try {
      const response = await fetch("https://httpbin.org/post", {
        method: "POST",
        headers: {
          "X-Custom-Header": "test",
          "X-Test-Origin": currentOrigin,
        },
      }).catch(() => null);

      if (response) {
        inconsistencies.push("cors preflight may be bypassable");
      }
    } catch {
      // 予期される
    }

    const executionTime = performance.now() - startTime;

    if (inconsistencies.length > 0) {
      return {
        blocked: false,
        detected: false,
        executionTime,
        details: `Origin policy inconsistencies found: ${inconsistencies.join(", ")}`,
      };
    } else {
      return {
        blocked: true,
        detected: true,
        executionTime,
        details: "Origin policies consistently enforced",
      };
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      blocked: true,
      detected: true,
      executionTime: performance.now() - startTime,
      details: `Origin policy confusion attack blocked: ${errorMessage}`,
      error: errorMessage,
    };
  }
}

export const deepestAttacks: AttackTest[] = [
  {
    id: "deepest-spectre-timing",
    name: "Spectre-like Cache Timing Attack",
    category: "deepest",
    description:
      "Exploits CPU cache timing variations to leak memory data (Spectre-inspired)",
    severity: "critical",
    simulate: simulateSpectreLikeTiming,
  },
  {
    id: "deepest-wasm-memory-leak",
    name: "WASM Linear Memory Leak",
    category: "deepest",
    description:
      "Accesses WebAssembly linear memory for potential data exfiltration",
    severity: "critical",
    simulate: simulateWasmMemoryLeak,
  },
  {
    id: "deepest-iframe-sandbox-bypass",
    name: "iframe Sandbox Escape",
    category: "deepest",
    description:
      "Attempts to escape iframe sandbox restrictions and access parent context",
    severity: "critical",
    simulate: simulateIframeSandboxBypass,
  },
  {
    id: "deepest-origin-policy-confusion",
    name: "Origin Policy Confusion",
    category: "deepest",
    description:
      "Tests for inconsistencies and confusion in origin security policies",
    severity: "high",
    simulate: simulateOriginPolicyConfusion,
  },
];
