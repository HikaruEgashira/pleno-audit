# Battacker Extension Analysis シグネチャ

## 概要

BrowserTotalのExtension Analysisカテゴリに対応するBattackerシグネチャの実装計画。

## 背景

BrowserTotalは以下のExtension テストを提供：
- Extension Enumeration（拡張機能列挙）
- Extension Attack Lab（拡張機能攻撃ラボ）
- Extension Vulnerability Scan（脆弱性スキャン）

Battackerは既存の`extension-risk-analyzer.ts`があるが、Battackerシグネチャとしての統合が必要。

## 既存実装の活用

### packages/extension-runtime/src/extension-risk-analyzer.ts

```typescript
// 既存機能
- パーミッション分析
- ネットワーク活動監視
- リスクスコア算出
```

**課題**: Battackerのシグネチャ形式に変換が必要

## シグネチャ定義

### 1. Extension Enumeration

```typescript
{
  id: "extension_enumeration",
  name: "Extension Enumeration",
  category: "extension_security",
  description: "Webページからの拡張機能列挙攻撃のシミュレーション",
  severity: "medium",
  weight: 12,
  tags: ["extension", "enumeration", "fingerprinting"],
  testFn: async (context) => {
    // 拡張機能の列挙テクニック
    // 1. web_accessible_resources経由
    // 2. Content Script注入の検出
    // 3. DOM変更の検出
  }
}
```

**攻撃ベクトル**:
- `chrome-extension://` URLプローブ
- DOMの拡張機能固有変更の検出
- Content Scriptの存在確認

### 2. Extension Privilege Escalation

```typescript
{
  id: "extension_privilege_escalation",
  name: "Extension Privilege Escalation",
  category: "extension_security",
  description: "拡張機能の権限昇格攻撃のシミュレーション",
  severity: "high",
  weight: 18,
  tags: ["extension", "privilege", "escalation"],
  testFn: async (context) => {
    // 権限昇格パターン
    // 1. 過剰な権限要求
    // 2. オプショナル権限の悪用
    // 3. tabs/webRequest権限の悪用
  }
}
```

**リスク権限**:
- `<all_urls>` - 全URLへのアクセス
- `tabs` - タブ情報へのアクセス
- `webRequest` - ネットワークリクエストの監視/変更
- `cookies` - Cookie操作
- `storage` - ストレージアクセス

### 3. Extension Communication Attack

```typescript
{
  id: "extension_communication_attack",
  name: "Extension Communication Attack",
  category: "extension_security",
  description: "拡張機能との通信を悪用する攻撃のシミュレーション",
  severity: "high",
  weight: 16,
  tags: ["extension", "communication", "messaging"],
  testFn: async (context) => {
    // 通信チャネル攻撃
    // 1. postMessage経由のメッセージ偽装
    // 2. externally_connectable悪用
    // 3. Native Messaging悪用
  }
}
```

**攻撃ベクトル**:
- `chrome.runtime.sendMessage`の偽装
- `postMessage`経由の攻撃
- Content Script <-> Background間の中間者攻撃

### 4. Extension Update Attack

```typescript
{
  id: "extension_update_attack",
  name: "Extension Update Attack",
  category: "extension_security",
  description: "拡張機能の更新メカニズムを悪用する攻撃のシミュレーション",
  severity: "critical",
  weight: 22,
  tags: ["extension", "update", "supply_chain"],
  testFn: async (context) => {
    // 更新攻撃パターン
    // 1. 悪意ある更新の検出
    // 2. 更新サーバーの改ざん
    // 3. Cyberhaven型サプライチェーン攻撃
  }
}
```

**参考事例**:
- Cyberhaven事件（2024年12月）
- 40万ユーザー影響

## 検出ロジック

### 拡張機能列挙検出

```typescript
function detectExtensionEnumeration(): boolean {
  // 1. web_accessible_resourcesへのプローブ検出
  const knownExtensions = [
    'cjpalhdlnbpafiamejdnhcphjbkeiagm', // uBlock Origin
    'bgnkhhnnamicmpeenaelnjfhikgbkllg', // AdGuard
    // ... 他の一般的な拡張機能
  ];

  let detected = false;

  // Image/Script経由のプローブ監視
  const observer = new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      if (entry.name.startsWith('chrome-extension://')) {
        detected = true;
        // プローブ試行をログ
      }
    }
  });

  observer.observe({ entryTypes: ['resource'] });

  return detected;
}
```

### 危険な権限の検出

```typescript
const DANGEROUS_PERMISSIONS = {
  critical: ['<all_urls>', 'debugger', 'nativeMessaging'],
  high: ['tabs', 'webRequest', 'webRequestBlocking', 'cookies'],
  medium: ['storage', 'clipboardRead', 'clipboardWrite'],
  low: ['notifications', 'alarms']
};

function analyzePermissions(manifest: chrome.runtime.Manifest): RiskScore {
  const permissions = [...(manifest.permissions || []), ...(manifest.host_permissions || [])];

  let score = 0;
  for (const perm of permissions) {
    if (DANGEROUS_PERMISSIONS.critical.includes(perm)) score += 30;
    else if (DANGEROUS_PERMISSIONS.high.includes(perm)) score += 20;
    else if (DANGEROUS_PERMISSIONS.medium.includes(perm)) score += 10;
    else if (DANGEROUS_PERMISSIONS.low.includes(perm)) score += 5;
  }

  return { score, level: score > 50 ? 'critical' : score > 30 ? 'high' : 'medium' };
}
```

## 実装ファイル

```
packages/battacker/
├── signatures/
│   └── extension-security/
│       ├── index.ts
│       ├── enumeration.ts
│       ├── privilege-escalation.ts
│       ├── communication.ts
│       └── update-attack.ts
└── categories/
    └── extension-security.ts
```

## 既存コードとの統合

### extension-risk-analyzer.ts との連携

```typescript
// Battackerシグネチャから既存のanalyzerを呼び出し
import { ExtensionRiskAnalyzer } from '@pleno-audit/extension-runtime';

const analyzer = new ExtensionRiskAnalyzer();
const riskResult = await analyzer.analyze(extensionId);

// 結果をBattackerスコアに変換
return {
  detected: riskResult.riskLevel !== 'low',
  score: riskResult.score,
  details: riskResult.findings
};
```

## テスト計画

### ユニットテスト
- 各シグネチャの検出精度テスト
- 既存analyzerとの統合テスト
- パフォーマンステスト

### 統合テスト
- 実際の拡張機能（uBlock, AdGuard等）での動作確認
- 悪意ある拡張機能のサンプルでのテスト

## 優先度

**高**: Cyberhaven事件以降、拡張機能セキュリティへの関心が高まっている

## 関連ADR

- ADR-028: Battacker拡張機能サンドボックス層（既存）
- 既存実装の拡張として対応可能
