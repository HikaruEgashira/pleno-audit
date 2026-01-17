# ADR-016: Battacker攻撃シグネチャ拡張

## ステータス
Accepted

## コンテキスト

ADR-015で定義したPleno Battackerの攻撃シミュレーションカテゴリには、PlenoAuditが監視していない攻撃ベクトルが存在する。

### 検知ギャップ分析

| 弱点 | 理由 |
|------|------|
| WebSocket | ai-hooks.jsはfetch/XHRのみフック |
| Web Worker | Worker内のfetchはメインスレッド監視外 |
| IndexedDB/Cache API | ストレージ監視なし |
| BroadcastChannel | タブ間通信監視なし |
| Canvas Fingerprinting | Canvas操作監視なし |
| Credential API | 認証情報API監視なし |
| Performance Timing | Performance API監視なし |

これらのギャップをカバーする攻撃シグネチャを追加し、PlenoAuditの検知力を正確に評価する必要がある。

## 決定

### 新規カテゴリの追加

既存の4カテゴリに加え、2つの新規カテゴリを追加する。

| カテゴリ | 重み | 内容 |
|---------|------|------|
| Network | 25% | Beacon、データ漏洩、C2、**WebSocket C2**、**Web Worker** |
| Phishing | 15% | クリップボード、**Credential API**、**Notification** |
| ClientSide | 20% | XSS、DOM操作、Cookie盗取 |
| Download | 15% | Blob URL、Data URL、疑わしいファイル |
| **Persistence** | 15% | **IndexedDB**、**Cache API**、**History State** |
| **Side-Channel** | 10% | **Canvas指紋**、**Performance Timing**、**BroadcastChannel** |

### 攻撃シグネチャ一覧

#### Network拡張（2個追加）
- `network-websocket-c2`: WebSocket経由のC2通信シミュレーション
- `network-webworker-exfil`: Web Worker内からのデータ漏洩

#### Phishing拡張（2個追加）
- `phishing-credential-api`: Credential Management APIによる認証情報取得
- `phishing-notification`: 偽セキュリティ通知によるフィッシング

#### Persistence（新規3個）
- `persistence-indexeddb`: IndexedDBへの機密データ隠匿
- `persistence-cache-api`: Cache Storage APIの悪用
- `persistence-history`: History State APIへのデータ埋め込み

#### Side-Channel（新規3個）
- `side-channel-canvas`: Canvas APIによるブラウザ指紋認証
- `side-channel-timing`: Performance APIからのタイミング情報抽出
- `side-channel-broadcast`: BroadcastChannelによるタブ間情報漏洩

### 設計方針

#### 外部サービス依存について
攻撃シミュレーションで使用する外部サービス（`echo.websocket.org`、`httpbin.org`等）は、サービス停止時にテストが失敗しても許容する。これは実際の攻撃環境を模擬するためであり、外部サービスの可用性に依存しない設計は求めない。

#### 外部通信ポリシーとの関係
CLAUDE.mdの「外部通信禁止」ポリシーはPleno Audit本体（監査ツール）に適用されるものであり、Battacker（Red Teamテストツール）は例外とする。ADR-015で定義済み。

#### ユーザー影響の最小化
- Notification権限テストは通知を100msで自動クローズ
- IndexedDB/Cache APIはテスト後に自動削除
- History Stateは元の状態に復元

#### 非機能要件
攻撃シミュレーションの性質上、パフォーマンス最適化や並列実行は優先しない。タイムアウト（最大5秒/テスト）は許容範囲内とする。

## 結果

- 攻撃シグネチャ: 10個 → 20個（100%増加）
- 攻撃カテゴリ: 4個 → 6個
- PlenoAuditの検知ギャップを網羅的に評価可能
- Red Team視点での防御力評価が実現
