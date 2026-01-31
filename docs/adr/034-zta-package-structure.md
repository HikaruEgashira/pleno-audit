# ADR-034: ZTAパッケージ構造

## ステータス

Accepted

## コンテキスト

pleno-auditのパッケージ構造がNIST SP 800-207 Zero Trust Architecture用語と整合していなかった。
extension-runtimeとalertsパッケージに機能が集中し、責務の分離が不明確だった。

## 決定

NIST SP 800-207のZTA用語に基づいてパッケージを再構成する。

### 新パッケージ構造

```
packages/
├── control-plane/
│   ├── policy-engine/       (@pleno-audit/policy-engine)
│   │   - PolicyManager, PolicyTypes
│   │   - TrustAlgorithm（CDMシグナル統合 → 信頼スコア算出）
│   │
│   └── policy-admin/        (@pleno-audit/policy-admin)
│       - EnterpriseManager
│
├── data-plane/
│   └── pep/                 (@pleno-audit/pep)
│       - BlockingEngine, CooldownManager
│       - AlertManager, AlertTypes
│
├── data-sources/
│   ├── cdm/                 (@pleno-audit/cdm)
│   │   - ExtensionRiskAnalyzer
│   │   - SuspiciousPatternDetector, DoHMonitor, CookieMonitor
│   │
│   ├── id-management/       (@pleno-audit/id-management)
│   │   - SSOManager
│   │
│   └── activity-logs/       (@pleno-audit/activity-logs)
│       - Storage, ApiClient, SyncManager（将来移行予定）
│
├── siem/                    (@pleno-audit/siem)
│   - ExtensionStatsAnalyzer
│
├── runtime-platform/        (@pleno-audit/runtime-platform)
│   - Logger, BrowserAdapter, MessageHandler, Offscreen
```

### Trust Algorithm

```typescript
export interface TrustInput {
  // CDMシグナル
  isNRD: boolean;
  nrdConfidence: "high" | "medium" | "low" | "unknown";
  typosquatConfidence: "high" | "medium" | "low" | "none";
  cspViolationCount: number;
  extensionRiskScore: number;
  suspiciousPatternCount: number;
  dohDetected: boolean;
  // Identityシグナル
  isAuthenticated: boolean;
  isEnterpriseManagedDevice: boolean;
  // Policyシグナル
  policyViolations: number;
}

export interface TrustScore {
  score: number;          // 0-100
  level: "trusted" | "conditional" | "untrusted";
  factors: TrustFactor[];
}

export function computeTrustScore(input: TrustInput): TrustScore;
```

### 依存関係グラフ

```
runtime-platform (foundation)
    ↑
    ├── id-management
    ├── activity-logs
    ├── cdm
    │
    ├── policy-engine (pure logic)
    │       ↑
    ├── policy-admin → id-management
    │       ↑
    └── pep → policy-engine
    │
    └── siem → cdm
```

## 結果

### 利点

1. **ZTA用語との整合**: NIST SP 800-207の概念に基づいた構造
2. **責務の分離**: Control Plane / Data Plane / Data Sources の明確な分離
3. **Trust Algorithm**: CDMシグナルを統合した信頼スコア算出機能
4. **拡張性**: 新しいData Sourcesやポリシーの追加が容易

### 課題

1. **後方互換性**: extension-runtimeとalertsからのre-exportが必要
2. **依存関係の複雑さ**: 一部ファイル（extension-monitor等）は依存関係が複雑で移行保留

### 移行方針

- 既存コードは段階的に新パッケージに移行
- extension-runtime/alertsはshimとして維持し、後方互換性を保証
- 新機能は新パッケージ構造で実装
