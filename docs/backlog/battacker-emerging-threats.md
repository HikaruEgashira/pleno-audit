# Battacker Emerging Threats シグネチャ

## 概要

BrowserTotalのEmerging Threatsカテゴリに対応するBattackerシグネチャの実装計画。

## 背景

BrowserTotalは11種のEmerging Threatsテストを提供：
- SocGholish
- ClickFix
- V8 Zero-Day
- Rowhammer.js
- Quantum Crypto Attack
- 他6種

これらは最新の脅威であり、Battackerのカバレッジ強化に重要。

## シグネチャ定義

### 1. SocGholish Attack

```typescript
{
  id: "socgholish_attack",
  name: "SocGholish Attack",
  category: "emerging_threats",
  description: "SocGholish（偽ブラウザ更新）攻撃のシミュレーション",
  severity: "high",
  weight: 20,
  tags: ["malware", "social_engineering", "fake_update"],
  testFn: async (context) => {
    // SocGholishパターン検出
    // 1. 偽のブラウザ更新ダイアログ
    // 2. 偽のFlash更新
    // 3. JavaScriptによるダウンロード誘導
  }
}
```

**攻撃パターン**:
- 「ブラウザを更新してください」系のオーバーレイ
- 緊急性を装った更新通知
- 自動ダウンロード誘導

**検出ロジック**:
```typescript
function detectSocGholish(document: Document): SocGholishResult {
  const suspiciousPatterns = [
    /browser.*update/i,
    /flash.*update/i,
    /your.*browser.*out.*of.*date/i,
    /critical.*update.*required/i,
    /download.*now.*to.*fix/i,
  ];

  const overlays = document.querySelectorAll('[style*="position: fixed"], [style*="z-index"]');

  for (const overlay of overlays) {
    const text = overlay.textContent || '';
    for (const pattern of suspiciousPatterns) {
      if (pattern.test(text)) {
        return {
          detected: true,
          element: overlay,
          pattern: pattern.source
        };
      }
    }
  }

  return { detected: false };
}
```

### 2. ClickFix Attack

```typescript
{
  id: "clickfix_attack",
  name: "ClickFix Attack",
  category: "emerging_threats",
  description: "ClickFix攻撃（クリックジャッキングの変種）のシミュレーション",
  severity: "high",
  weight: 18,
  tags: ["clickjacking", "ui_redressing", "social_engineering"],
  testFn: async (context) => {
    // ClickFixパターン検出
    // 1. 透明なオーバーレイ
    // 2. UIの位置偽装
    // 3. CAPTCHAを装った攻撃
  }
}
```

**攻撃パターン**:
- 「私はロボットではありません」を装ったボタン
- 偽のCAPTCHA
- 透明なiframe上のクリック誘導

**検出ロジック**:
```typescript
function detectClickFix(document: Document): ClickFixResult {
  const captchaPatterns = [
    /i.*am.*not.*a.*robot/i,
    /verify.*you.*are.*human/i,
    /click.*to.*verify/i,
    /captcha/i,
  ];

  // 透明/半透明のオーバーレイ検出
  const overlays = document.querySelectorAll('*');
  for (const el of overlays) {
    const style = window.getComputedStyle(el);
    const opacity = parseFloat(style.opacity);

    if (opacity > 0 && opacity < 0.5) {
      const text = el.textContent || '';
      for (const pattern of captchaPatterns) {
        if (pattern.test(text)) {
          return {
            detected: true,
            element: el,
            reason: 'transparent_captcha_overlay'
          };
        }
      }
    }
  }

  return { detected: false };
}
```

### 3. V8 Zero-Day Simulation

```typescript
{
  id: "v8_zeroday_simulation",
  name: "V8 Zero-Day Simulation",
  category: "emerging_threats",
  description: "V8 JavaScriptエンジンのゼロデイ脆弱性をシミュレート",
  severity: "critical",
  weight: 25,
  tags: ["zeroday", "v8", "javascript_engine"],
  testFn: async (context) => {
    // V8脆弱性パターン
    // 1. 型混乱（Type Confusion）
    // 2. 範囲外アクセス（Out-of-Bounds）
    // 3. JITコンパイラ脆弱性
  }
}
```

**シミュレーション内容**:
- 既知のV8脆弱性パターンの再現（安全な形式）
- ブラウザのバージョン確認
- 脆弱なバージョンの警告

**注意**: 実際の脆弱性を悪用するのではなく、パターンの検出と警告のみ

### 4. Rowhammer.js

```typescript
{
  id: "rowhammer_js",
  name: "Rowhammer.js",
  category: "emerging_threats",
  description: "Rowhammer.js（メモリ攻撃）のシミュレーション",
  severity: "critical",
  weight: 22,
  tags: ["hardware", "memory", "side_channel"],
  testFn: async (context) => {
    // Rowhammerパターン検出
    // 1. 大量のArrayBuffer割り当て
    // 2. メモリアクセスパターンの分析
    // 3. SharedArrayBuffer使用の検出
  }
}
```

**検出ロジック**:
```typescript
function detectRowhammerPatterns(): RowhammerResult {
  // ArrayBufferの大量割り当て検出
  const originalArrayBuffer = ArrayBuffer;
  let allocationCount = 0;
  let totalSize = 0;

  // プロキシで監視
  // 閾値を超えた場合に警告
  const THRESHOLD_COUNT = 1000;
  const THRESHOLD_SIZE = 100 * 1024 * 1024; // 100MB

  if (allocationCount > THRESHOLD_COUNT || totalSize > THRESHOLD_SIZE) {
    return {
      detected: true,
      reason: 'suspicious_memory_allocation',
      allocationCount,
      totalSize
    };
  }

  return { detected: false };
}
```

### 5. Quantum Crypto Attack Simulation

```typescript
{
  id: "quantum_crypto_attack",
  name: "Quantum Crypto Attack",
  category: "emerging_threats",
  description: "量子コンピュータ脅威のシミュレーション",
  severity: "medium",
  weight: 12,
  tags: ["quantum", "crypto", "future_threat"],
  testFn: async (context) => {
    // 量子脆弱な暗号の検出
    // 1. RSA/ECDSA使用の検出
    // 2. TLS設定の確認
    // 3. ポスト量子暗号対応の確認
  }
}
```

**検出内容**:
- TLS接続の暗号スイート確認
- RSA/ECDSAベースの証明書検出
- ポスト量子暗号（Kyber等）対応の確認

### 6. WebRTC IP Leak (Enhanced)

```typescript
{
  id: "webrtc_ip_leak_enhanced",
  name: "WebRTC IP Leak (Enhanced)",
  category: "emerging_threats",
  description: "WebRTC経由のIP漏洩検出（強化版）",
  severity: "high",
  weight: 16,
  tags: ["webrtc", "privacy", "ip_leak"],
  testFn: async (context) => {
    // WebRTC IP漏洩の高度な検出
    // 1. STUN/TURNサーバーへの接続
    // 2. ローカルIP取得試行
    // 3. VPN/Tor使用時のリーク
  }
}
```

## 実装ファイル

```
packages/battacker/
├── signatures/
│   └── emerging-threats/
│       ├── index.ts
│       ├── socgholish.ts
│       ├── clickfix.ts
│       ├── v8-zeroday.ts
│       ├── rowhammer.ts
│       ├── quantum-crypto.ts
│       └── webrtc-leak.ts
└── categories/
    └── emerging-threats.ts
```

## 既存ADRとの関連

- ADR-023: Battacker Zero-Day & Quantum脅威層
- ADR-026: Battacker レンダリングエンジン層

これらのADRを参照し、既存設計との整合性を確保。

## テスト計画

### ユニットテスト
- 各シグネチャの検出精度テスト
- 誤検知率のテスト
- パフォーマンステスト

### 統合テスト
- 既知の攻撃サンプル（安全なもの）でのテスト
- BrowserTotalとの結果比較

## 実装優先度

| シグネチャ | 優先度 | 理由 |
|-----------|--------|------|
| SocGholish | 高 | 実際の攻撃で頻繁に使用 |
| ClickFix | 高 | 増加傾向の攻撃 |
| WebRTC IP Leak | 中 | プライバシー保護に重要 |
| V8 Zero-Day | 中 | 検出は複雑だが重要 |
| Rowhammer.js | 低 | 実用性は限定的 |
| Quantum Crypto | 低 | 将来の脅威 |

## 参考資料

- [SocGholish Analysis](https://www.proofpoint.com/us/threat-reference/socgholish)
- [ClickFix Campaigns](https://www.bleepingcomputer.com/tag/clickfix/)
- [V8 Security](https://v8.dev/docs/security)
- [Rowhammer.js Paper](https://gruss.cc/files/rowhammer.js.pdf)
