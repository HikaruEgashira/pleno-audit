# ADR-017: Battacker高度攻撃シグネチャ拡張

## ステータス
Proposed

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

## 結果

- 攻撃シグネチャ: 20個 → 34個（70%増加）
- 攻撃カテゴリ: 6個 → 9個
- PlenoAuditの評価範囲を大幅に拡大
- Fingerprinting、Cryptojacking、Privacyという3つの主要脅威カテゴリをカバー

### 期待される評価結果

PlenoAuditは現在これらの新規カテゴリに対する検知機能を持たないため、以下の結果が予想される：

| カテゴリ | 予想スコア | 理由 |
|---------|------------|------|
| Fingerprinting | 0% | Canvas以外のFingerprinting検知なし |
| Cryptojacking | 0% | マイニング検知機能なし |
| Privacy | 部分的 | 一部APIはブラウザ自体がブロック |

これにより、PlenoAuditの次期開発優先度を決定するための客観的データを提供する。
