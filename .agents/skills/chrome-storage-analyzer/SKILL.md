---
name: pleno-audit-storage-analyzer
description: |
  Pleno Audit拡張機能のローカルストレージを分析するスキル。
  ネットワーク監視データ、サービス検出、Battackerテスト結果、設定値の調査に使用。
  Trigger: Pleno Audit分析, ストレージ調査, 拡張機能デバッグ, セキュリティ監査データ,
  network monitor, service detection, battacker results
---

# Pleno Audit Storage Analyzer

## 拡張機能IDの取得

```bash
# 方法1: chrome://extensions でデベロッパーモードON → IDが表示される

# 方法2: ストレージディレクトリ一覧から特定
STORAGE_BASE=~/Library/Application\ Support/Google/Chrome/Default/Local\ Extension\ Settings
ls "$STORAGE_BASE"

# 方法3: 各ストレージ内のデータからPleno Auditを検索
for dir in "$STORAGE_BASE"/*; do
  if cat "$dir"/*.log 2>/dev/null | strings | rg -q "Pleno Audit"; then
    echo "Found: $(basename "$dir")"
  fi
done
```

## ストレージパス

```bash
# macOS
STORAGE_BASE=~/Library/Application\ Support/Google/Chrome/Default/Local\ Extension\ Settings
PLENO_PATH="$STORAGE_BASE/<extension-id>"

# Windows
# %LOCALAPPDATA%\Google\Chrome\User Data\Default\Local Extension Settings\<extension-id>

# Linux
# ~/.config/google-chrome/Default/Local Extension Settings/<extension-id>
```

## データスキーマ

### 監視データ

| キー | 説明 |
|------|------|
| `extensionRequests` | 拡張機能ネットワークリクエスト `{domain, extensionId, extensionName, method, url, timestamp}[]` |
| `doHRequests` | DoH検出 `{domain, detectionMethod, url, initiator, blocked}[]` |
| `cspReports` | CSP違反レポート |
| `services` | 検出サービス `{[domain]: {cookies, privacyPolicyUrl, termsOfServiceUrl, hasLoginPage}}` |

### セキュリティテスト

| キー | 説明 |
|------|------|
| `battacker_lastResult` | Battackerテスト結果（カテゴリ別スコア） |

### 設定

| キー | 説明 |
|------|------|
| `aiMonitorConfig` | AIプロンプト監視 `{enabled, capturePrompts, captureResponses}` |
| `blockingConfig` | ブロッキング設定 `{blockNRDLogin, blockTyposquat, blockHighRiskExtension}` |
| `extensionMonitorConfig` | 拡張機能監視 `{enabled, maxStoredRequests}` |
| `nrdConfig` | NRD検出 `{thresholdDays, rdapTimeout}` |
| `forecastConfig` | 予測 `{forecastDays, trendThreshold}` |
| `themeMode` | テーマ `"light" | "dark" | "system"` |

## 分析コマンド

**重要**: `strings`は`cat`からパイプで使用すること

### 基本情報

```bash
# ストレージサイズ
du -sh "$PLENO_PATH"

# ファイル一覧（最新の.logファイルを使用）
ls "$PLENO_PATH"
```

### データ抽出

```bash
# 全データサンプル
cat "$PLENO_PATH"/*.log | strings | head -200

# 設定値一覧
cat "$PLENO_PATH"/*.log | strings | rg "Config"

# ネットワーク監視データ
cat "$PLENO_PATH"/*.log | strings | rg "extensionRequests" -A 2

# サービス検出（ドメイン一覧）
cat "$PLENO_PATH"/*.log | strings | rg -o '"domain":"[^"]+"' | sort -u

# DoH検出
cat "$PLENO_PATH"/*.log | strings | rg "doHRequests" -A 2

# Battacker結果
cat "$PLENO_PATH"/*.log | strings | rg "battacker_lastResult" -A 10
```

### 詳細抽出

```bash
# 特定ドメインの調査
cat "$PLENO_PATH"/*.log | strings | rg "example.com"

# プライバシーポリシーURL一覧
cat "$PLENO_PATH"/*.log | strings | rg -o '"privacyPolicyUrl":"[^"]+"' | sort -u

# Cookie検出状況
cat "$PLENO_PATH"/*.log | strings | rg -o '"cookies":\[[^\]]*\]' | head -10

# ログインページ検出
cat "$PLENO_PATH"/*.log | strings | rg '"hasLoginPage":true'
```

## 分析ユースケース

1. **ネットワーク監視確認** - 拡張機能の外部通信を確認
2. **サービス検出精度** - プライバシーポリシー/利用規約URL検出率
3. **Battacker結果** - カテゴリ別防御スコア
4. **設定デバッグ** - 各種Config値の状態確認

## 注意

- IndexedDB（parquet-storage）は別パスに保存される

### 機密データの取り扱い

抽出データにはセッション情報やCookieが含まれる可能性がある。

```bash
# 出力をファイルに保存しない（標準出力のみ使用）
cat "$PLENO_PATH"/*.log | strings | rg "keyword"

# 出力が必要な場合は一時ファイルを使用し、終了後に削除
TMP=$(mktemp) && cat "$PLENO_PATH"/*.log | strings > "$TMP" && rg "keyword" "$TMP"; rm "$TMP"

# Gitにコミットしない
# .gitignoreに追加: *.log, *.dump, storage-analysis/
```
