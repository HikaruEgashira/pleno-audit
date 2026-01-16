# ADR 014: DoH（DNS over HTTPS）監視機能

## ステータス

Accepted

## コンテキスト

DoH（DNS over HTTPS）はDNSクエリをHTTPS経由で暗号化して送信するプロトコル（RFC 8484）である。プライバシー保護に有効な一方、以下のセキュリティ上の懸念がある：

- **セキュリティ監視の回避**: 従来のDNSベースの脅威検知をバイパス
- **データ漏洩経路**: DoHトンネリングによる情報流出の可能性
- **シャドーIT**: 企業管理外のDNS解決が行われる

CASBとしてDoH通信の可視化と制御が必要である。

## 決定

### 検出方式

**RFC 8484プロトコル仕様に基づく汎用検出を採用する**

特定のDoHプロバイダー（Cloudflare、Google等）のリストは保持せず、プロトコルの特徴から検出する。

理由：
1. プロジェクトポリシー「外部DB禁止」への準拠
2. 新しいDoHサービスへの自動対応
3. メンテナンスコストの低減

### 検出方法（4種類）

1. **Content-Type検出（POST DoH）**
   - `application/dns-message`ヘッダーを検出

2. **Accept検出**
   - Acceptヘッダーに`application/dns-message`を含む

3. **URLパスパターン検出**
   - `/dns-query`で終わるパス（RFC 8484推奨パス）

4. **DNSクエリパラメータ検出（GET DoH）**
   - `dns=`パラメータの存在

### アクション設定（3段階）

| アクション | 説明 | 実装 |
|-----------|------|------|
| `detect` | 検出のみ（デフォルト） | ログ記録 |
| `alert` | 検出時に通知 | Chrome通知表示 |
| `block` | ブロック | declarativeNetRequest |

### アーキテクチャ

```
webRequest.onBeforeSendHeaders
  │ ヘッダー・URL解析でDoH検出
  ↓
doh-monitor.ts (detectDoHRequest)
  │ DoHRequestRecord生成
  ↓
background.ts
  ├→ chrome.storage.local保存
  ├→ 通知表示（alert時）
  └→ declarativeNetRequestルール適用（block時）
  ↓
Popup UI
  ├→ DoHList.tsx（通信一覧）
  └→ DoHSettings.tsx（設定変更）
```

### ブロッキング実装

`chrome.declarativeNetRequest`（MV3推奨）を採用：
- webRequestのblockingResponseより効率的
- 動的ルール（ID: 9999）でURLフィルター`*/dns-query*`を適用

### デフォルト動作

`detect`（検出のみ）をデフォルトとする。

理由：
- ADR-002「検出・可視化ファースト」の方針に準拠
- ユーザーの意図しないブロックを防止
- ブロッキングはユーザーの明示的な設定で有効化

## 結果

### 利点

1. 特定プロバイダーに依存しない汎用的な検出
2. 外部通信・外部DBなしでプライバシー保護
3. 3段階のアクションでユーザー要件に柔軟対応
4. MV3準拠の効率的なブロッキング実装

### 制約

1. 非標準的なDoH実装（独自パス、独自Content-Type）は検出されない可能性
2. `/dns-query`以外のパスを使用するサービスは検出漏れの可能性
3. 暗号化ペイロードの内容解析は不可

## 使用API

- `chrome.webRequest.onBeforeSendHeaders` - DoH検出
- `chrome.declarativeNetRequest` - ブロッキング
- `chrome.storage.local` - リクエスト・設定の永続化
- `chrome.notifications` - アラート通知
- `chrome.runtime.sendMessage` - UI連携

## 関連ADR

- ADR-002: 検出・可視化ファーストの方針
- ADR-011: AIプロンプト監視（類似の検出アーキテクチャ）
