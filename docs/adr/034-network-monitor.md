# ADR 034: Network Monitor - 全ネットワークリクエスト監視

## ステータス

Accepted

## コンテキスト

### 背景
- Extension Monitor（拡張機能監視）は拡張機能からのリクエストのみを監視していた
- ZTA（ゼロトラストアーキテクチャ）の原則では、全ネットワーク通信の可視化が求められる
- まだ必要なものがわかっていない段階では、多くのログを取得することを優先する

### 問題
| 観点 | 旧実装（Extension Monitor） | 要件 |
|------|---------------------------|------|
| 監視対象 | 拡張機能のみ | 全リクエスト |
| posture可視化 | 部分的 | 完全 |
| フィルタリング | あり | なし（全記録） |

## 決定

### Extension MonitorをNetwork Monitorに拡張する

1. **名称変更**: Extension Monitor → Network Monitor
2. **監視対象の拡張**: 拡張機能のみ → 全ネットワークリクエスト
3. **フィルタの削除**: `isExtensionRequest()`による絞り込みを削除
4. **initiatorType分類**: リクエスト発信元を分類（extension/page/browser/unknown）

### データ構造

```typescript
interface NetworkRequestRecord {
  id: string;
  timestamp: number;
  url: string;
  method: string;
  domain: string;
  resourceType: string;
  initiator: string | null;
  initiatorType: 'extension' | 'page' | 'browser' | 'unknown';
  extensionId?: string;
  extensionName?: string;
  tabId: number;
  frameId: number;
  detectedBy: 'webRequest' | 'declarativeNetRequest';
}

interface NetworkMonitorConfig {
  enabled: boolean;
  captureAllRequests: boolean;
  excludeOwnExtension: boolean;
  excludedDomains: string[];
  excludedExtensions: string[];
}
```

### 実装

- `extension-monitor.ts` → `network-monitor.ts`にリネーム
- `DNRSettings.tsx` → `NetworkMonitorSettings.tsx`にリネーム
- debugger CLI: `dnr` → `network`コマンド
- 後方互換性のためのエイリアス（`createExtensionMonitor`等）を一時的に維持（後に削除済み）

## 理由

- **ZTA準拠**: 全ネットワーク通信を記録し、セキュリティposture（態勢）を可視化する
- **Posture優先**: フィルタリングではなく、まず全記録してから分析する
- **未知への対応**: 必要なものがわかっていない段階では、多くのログを取得することが重要

## リスクと対応

| リスク | 対応 |
|--------|------|
| ストレージ肥大化 | `unlimitedStorage`権限で対応（ADR 033） |
| パフォーマンス | 将来的にサンプリングやフィルタオプションを追加可能 |

## 更新履歴

### 後方互換レイヤーの完全削除

後方互換レイヤー（`ExtensionMonitor`, `ExtensionMonitorConfig`, `createExtensionMonitor`, `registerExtensionMonitorListener`, `DEFAULT_EXTENSION_MONITOR_CONFIG`）を完全削除した。

**理由**: `createExtensionMonitor` が `captureAllRequests: false` をハードコードしていたため、全リクエスト監視が機能しないバグが発生した。後方互換ファサードは技術負債であり、同種のバグ再発リスクになるため削除。

## 関連

- ADR 033: ZTA監査証跡のためのunlimitedStorage採用
- PR #225: Network Monitor - 全ネットワークリクエスト監視機能
