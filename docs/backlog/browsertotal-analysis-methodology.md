# BrowserTotal 分析手法

## 概要

BrowserTotalは131テストを11並列で実行するブラウザセキュリティスキャナーである。
本ドキュメントは、BrowserTotalスキャンを安全かつ効果的に実行し、Battackerとの比較分析を行うための手法を確立する。

## 前提条件

### システム要件
- **CPU**: 高負荷に耐えられるマルチコアプロセッサ
- **メモリ**: 8GB以上推奨（スキャン中は高メモリ使用）
- **ブラウザ**: Chrome/Chromium（最新版）
- **注意**: 11並列実行によりCPU使用率100%に達することがある

### 既知の制約
- 66%付近でブラウザが停止することがある
- 外部通信を行う（プライバシー考慮が必要）
- スキャン完了まで5-10分かかる

## スキャン実行手順

### Step 1: 事前準備

```bash
# 他の重要なプロセスを終了
# ブラウザのタブを最小限に

# システムリソース監視（別ターミナル）
top -pid $(pgrep "Google Chrome")
```

### Step 2: スキャン実行

1. https://browsertotal.com/browser-posture-scan にアクセス
2. 「Start Security Scan」をクリック
3. 進捗を監視（CPU負荷が高い場合は注意）

### Step 3: 結果キャプチャ

スキャンが停止した場合でも、以下の情報を記録：

| 項目 | 記録内容 |
|------|---------|
| 進捗率 | XX% |
| Total | テスト総数 |
| Passed | 成功数 |
| Failed | 失敗数 |
| Running | 実行中数 |
| Queued | 待機中数 |

### Step 4: 詳細ログ収集

Console出力から以下を抽出：
- タイムスタンプ付きログ（SUCCESS/ERROR/WARNING）
- 各テストの結果詳細
- エラーメッセージ

## データ保存形式

### ファイル命名規則
```
docs/scan-data/browsertotal-scan-YYYY-MM-DD.md
```

### ファイル構造
```markdown
# BrowserTotal Scan Results - YYYY-MM-DD

## Scan Overview
- **URL**: https://browsertotal.com/browser-posture-scan
- **Version**: vX.X.XX / vX.X
- **Total Tests**: XXX
- **Progress at capture**: XX%

## Final Statistics

| Metric | Value |
|--------|-------|
| Total | XXX |
| Passed | XXX |
| Failed | XXX |
| Running | XXX |
| Queued | XXX |

## Detected Vulnerabilities (ERROR)
### 1. [Test Name] - FAILED
- **Time**: HH:MM:SS
- **Result**: [詳細結果]
- **Severity**: High/Medium/Low
- **Category**: [カテゴリ]

## Warnings
### 1. [Test Name]
- **Time**: HH:MM:SS
- **Result**: [詳細結果]
- **Category**: [カテゴリ]

## Passed Tests (SUCCESS)
| Test | Result |
|------|--------|
| [Test Name] | ✅ PASSED |

## Raw Log Data
```
[HH:MM:SS] SUCCESS/ERROR/WARNING - [Message]
```

## Analysis Notes
- 発見事項
- Battackerとの比較ポイント
```

## 比較分析手法

### Battackerとの対応表作成

| BrowserTotal テスト | Battacker 対応 | ギャップ |
|---------------------|----------------|---------|
| Socgholish Protection | なし | 追加必要 |
| XSS Protection | client-xss | 拡張検討 |
| SSL Validation | protocol-standards | - |

### 結果の相関分析

同一環境で両スキャナーを実行し、以下を比較：

1. **検出一致率**: 同じ脆弱性を検出したか
2. **検出差分**: 片方のみが検出した脆弱性
3. **重要度評価**: 同じ問題に対する評価の差異

### ギャップ優先度付け

| 優先度 | 基準 |
|--------|------|
| 高 | BrowserTotalで検出失敗 & Battackerに対応なし |
| 中 | BrowserTotalで警告 & Battackerで部分対応 |
| 低 | BrowserTotalのみの機能（ツール類等） |

## トラブルシューティング

### ブラウザ停止時の対応

```bash
# 1. プロセス状態確認
ps aux | grep -i chrome

# 2. 強制終了（必要な場合のみ）
pkill -9 "Google Chrome"

# 3. 部分結果の保存
# Console出力をコピーしてログファイルに保存
```

### CPU高負荷時の対策

1. **予防**: 他のアプリケーションを終了
2. **監視**: CPU使用率が100%に達したら注意
3. **回復**: 66%以上進行していれば十分なデータが取得可能

## 自動化（将来計画）

### Puppeteer/Playwrightによる自動化

```typescript
// 将来的な自動化スクリプト案
async function runBrowserTotalScan() {
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();

  // タイムアウト設定（高負荷対策）
  page.setDefaultTimeout(300000); // 5分

  await page.goto('https://browsertotal.com/browser-posture-scan');

  // スキャン開始ボタンをクリック
  await page.click('[data-testid="start-scan"]');

  // 結果待機と収集
  // ...
}
```

### MCP統合案

Claude in Chrome MCPツールを使用した半自動化：
1. `mcp__claude-in-chrome__navigate` でスキャンページに移動
2. `mcp__claude-in-chrome__computer` でスキャン開始
3. `mcp__claude-in-chrome__read_console_messages` でログ収集
4. 結果をMarkdownファイルに保存

## 定期実行スケジュール

| 頻度 | 目的 |
|------|------|
| リリース前 | 新機能追加時の比較 |
| 月次 | 定期的なギャップ確認 |
| BrowserTotal更新時 | 新テスト追加の確認 |

## 関連ドキュメント

- [比較分析レポート](../scan-data/comparison-analysis.md)
- [BrowserTotal ギャップ分析](./browsertotal-gap-analysis.md)
- [AI Security バックログ](./battacker-ai-security.md)
- [Emerging Threats バックログ](./battacker-emerging-threats.md)
