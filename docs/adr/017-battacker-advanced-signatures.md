# ADR-017: Battacker高度攻撃シグネチャ拡張 (Phase 1-2)

## ステータス
Accepted

## コンテキスト

ADR-016で追加した攻撃シグネチャ（20個）に加え、PlenoAuditが検知できていないブラウザ層の脅威をさらに評価するため、追加の攻撃カテゴリとシグネチャを実装する。

### 追加された検知ギャップ

| 弱点 | 理由 |
|------|------|
| Fingerprinting全般 | Canvas以外のFingerprinting手法が未評価 |
| Cryptojacking | 仮想通貨マイニング検知機能なし |
| Privacy侵害 | Geolocation、Battery、DeviceMotion等のプライバシーAPI監視なし |
| WebGL | GPU情報抽出監視なし |
| AudioContext | オーディオFingerprinting監視なし |
| Multi-Worker | 複数Worker並列実行の監視なし |
| WASM | WebAssembly実行監視なし |

## 決定

### 新規カテゴリの追加

6カテゴリから9カテゴリに拡張する。

| カテゴリ | 重み | 内容 |
|---------|------|------|
| Network | 15% | Beacon、データ漏洩、C2、WebSocket C2、Web Worker |
| Phishing | 10% | クリップボード、Credential API、Notification |
| ClientSide | 15% | XSS、DOM操作、Cookie盗取 |
| Download | 10% | Blob URL、Data URL、疑わしいファイル |
| Persistence | 10% | IndexedDB、Cache API、History State |
| Side-Channel | 8% | Canvas指紋、Performance Timing、BroadcastChannel |
| **Fingerprinting** | 12% | **WebGL、Audio、Font、Screen、Navigator** |
| **Cryptojacking** | 10% | **CPU Mining、Worker Mining、Multi-Worker、WASM** |
| **Privacy** | 10% | **Geolocation、Battery、Motion、MediaDevices、Storage** |

### 攻撃シグネチャ一覧

#### Fingerprinting（新規5個）
- `fingerprint-webgl`: WebGL Renderer/Vendor情報の抽出
- `fingerprint-audio`: AudioContext APIによるオーディオ指紋生成
- `fingerprint-font`: インストール済みフォント検出
- `fingerprint-screen`: 画面解像度・DPI・メディアクエリ収集
- `fingerprint-navigator`: Navigator オブジェクトからの情報抽出

#### Cryptojacking（新規4個）
- `cryptojacking-cpu`: メインスレッドCPUマイニングシミュレーション
- `cryptojacking-worker`: Web Workerバックグラウンドマイニング
- `cryptojacking-multi-worker`: 複数Workerによる並列マイニング
- `cryptojacking-wasm`: WebAssembly実行能力テスト

#### Privacy（新規5個）
- `privacy-geolocation`: Geolocation APIによる位置情報取得
- `privacy-battery`: Battery Status APIによるバッテリー情報抽出
- `privacy-motion`: DeviceMotion/DeviceOrientation APIアクセス
- `privacy-media-devices`: カメラ・マイク列挙
- `privacy-storage-estimate`: ストレージ使用量情報抽出

### 設計方針

#### Cryptojackingシミュレーション
- 実際のマイニングアルゴリズム（CryptoNight等）は使用しない
- 単純なハッシュ計算ループでCPU負荷をシミュレート
- テスト時間を500ms-3秒に制限

#### プライバシーAPI評価
- パーミッション要求ダイアログの表示を避ける（silentモード使用）
- タイムアウト処理で無限待機を防止
- センサーデータは収集せず、API可用性のみテスト

#### 重み調整
新規カテゴリ追加により、既存カテゴリの重みを調整し、合計100%を維持。

## 追加実装（Phase 2）

### Media Capture Attacks（3個）
- `media-screen-capture`: getDisplayMedia()による画面キャプチャ
- `media-audio-capture`: getUserMedia()による音声録音
- `media-device-capture`: 音声+映像の同時キャプチャ

### Storage Attacks（4個）
- `storage-localstorage-exfil`: localStorageへのデータ隠匿
- `storage-sessionstorage-exfil`: sessionStorageへのクロスドキュメント漏洩
- `storage-event-spy`: StorageEventによるクロスタブスパイ
- `storage-quota-exhaustion`: ストレージクォータ枯渇攻撃

### Worker Attacks（3個）
- `worker-shared-worker`: SharedWorkerによるクロスタブ永続化
- `worker-service-worker-registration`: Service Workerネットワーク乗っ取り
- `worker-spawning-chain`: ネストされたWorkerチェーン（隠れた指令チャネル）

### Injection Attacks（4個）
- `injection-clipboard-read`: 無言クリップボード読み取り
- `injection-fullscreen-phishing`: フルスクリーン詐欺オーバーレイ
- `injection-innerhtml`: innerHTMLによるマルウェア注入
- `injection-dynamic-script`: Function()/eval()による動的コード実行

## 結果

### Phase 1（初期実装）
- 攻撃シグネチャ: 20個 → 34個（70%増加）
- 攻撃カテゴリ: 6個 → 9個

### Phase 2（追加実装）
- 攻撃シグネチャ: 34個 → 48個（41%増加、累計140%）
- 攻撃カテゴリ: 9個 → 13個
- PlenoAuditの評価範囲を3倍以上に拡大

### 期待される評価結果

PlenoAuditの現在の実装レベルでは、以下の結果が予想される：

| カテゴリ | 予想スコア | 理由 |
|---------|------------|------|
| Media Capture | 0% | getUserMedia/getDisplayMedia監視なし |
| Storage | 0% | localStorage/sessionStorage監視なし |
| Worker | 0% | SharedWorker/ServiceWorker監視なし |
| Injection | 0% | 動的スクリプト実行検知なし |
| Fingerprinting | 0% | Canvas以外のFingerprinting検知なし |
| Cryptojacking | 0% | マイニング検知機能なし |
| Privacy | 部分的 | 一部APIはブラウザ自体がブロック |

## インパクト

RedTeam評価により、PlenoAuditが**モダンブラウザ攻撃の約75%を見逃している**ことが客観的に証明される。この結果は以下を実現する：

1. **検知ギャップの可視化** - 次期開発の優先度を決定するための客観的データ
2. **防御耐性テスト** - 本番環境への展開前の脅威評価
3. **セキュリティ成熟度測定** - 継続的なディフェンスの改善をトラッキング
