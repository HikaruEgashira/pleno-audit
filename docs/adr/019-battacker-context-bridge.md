# ADR 019: Battacker コンテキストブリッジ攻撃シグネチャ

**Status**: Accepted

**Date**: 2026-01-17

**Context**

Phase 6で示されたIMPLEMENT Immediate Q1 要件をさらに拡張し、クロスオリジンコンテキスト間の通信とタイミング系攻撃を実装する必要がある。特に以下の領域での検知回避メカニズムが重要：

1. **合法的な通信 API の悪用** - postMessage は SOP-compliant だが、検知パターンなし
2. **タイミング測定攻撃** - Performance API から情報推測
3. **キャッシュサイドチャネル** - ブラウザキャッシュを情報リークに悪用
4. **低レベルメモリアクセス** - WASM table からメモリレイアウト推測
5. **HTTPプロトコル層の悪用** - リダイレクトでのパラメータ漏洩

## Phase 7: Context Bridge & Timing Attacks

### 追加されたContext Bridge攻撃シグネチャ（5個）

#### 1. Window.open + postMessage Context Bridge
- **ID**: `context-bridge-window-postmessage`
- **Severity**: High
- **カテゴリ**: Covert
- **検知率**: 0%

**手法**:
```typescript
const popup = window.open("about:blank");
popup.postMessage({type: "exfil_query"}, "*");
// ポップアップから親へ window.opener.postMessage()
```

**検知ギャップ**:
- postMessage は SOP-compliant
- 合法的なウィンドウ間通信
- 検知パターンなし

**推奨対策**:
- postMessage の origin フィルタリング
- cross-origin ウィンドウ通信の検知

---

#### 2. Timing Oracle Attack via Performance.measure()
- **ID**: `context-bridge-timing-oracle`
- **Severity**: High
- **カテゴリ**: Side-Channel
- **検知率**: 0%

**手法**:
```typescript
performance.mark("start");
// 有効/無効ユーザー名検証ロジック
performance.mark("end");
performance.measure("validation", "start", "end");
// タイミング差分で有効性判定
```

**検知ギャップ**:
- Performance API は開発用
- タイミング測定自体の監視なし
- ユーザー名列挙が可能

**推奨対策**:
- performance.measure() の引数ログ
- 異常なタイミング差分の検知

---

#### 3. HTTP Cache Side-Channel Attack
- **ID**: `context-bridge-cache-sidechannel`
- **Severity**: High
- **カテゴリ**: Covert
- **検知率**: 0%

**手法**:
```typescript
// キャッシュヒット（< 10ms）
await fetch(url, {cache: "force-cache"});

// キャッシュミス（> 50ms）
await fetch(url, {cache: "no-store"});

// タイミング差分から資源存在を推測
```

**検針ギャップ**:
- ブラウザキャッシュの透過的動作
- キャッシュ時間の監視なし
- 資源存在の可視化

**推奨対策**:
- fetch() の cache オプション制限
- キャッシュアクセスパターン監視

---

#### 4. WASM Indirect Call Table Attack
- **ID**: `context-bridge-wasm-indirect`
- **Severity**: Critical
- **カテゴリ**: Deepest
- **検知率**: 0%

**手法**:
```typescript
const module = await WebAssembly.compile(wasmCode);
const instance = await WebAssembly.instantiate(module);
const table = instance.instance.tables[0];
const funcRef = table.get(0); // メモリレイアウト推測
```

**検知ギャップ**:
- WASM table API の低レベルアクセス
- テーブルアクセス監視なし
- 関数ポインタ抽出が可能

**推奨対策**:
- WASM table.get() の監視
- 異常なテーブルアクセスパターンの検知

---

#### 5. Redirect Chain Attack (302/304)
- **ID**: `context-bridge-redirect-chain`
- **Severity**: High
- **カテゴリ**: Advanced
- **検知率**: 0%

**手法**:
```typescript
const response = await fetch(url, {redirect: "follow"});
// 302 リダイレクトで attacker.local にパラメータ流出
// 304 Not Modified でキャッシュバージョン返却
```

**検知ギャップ**:
- HTTP リダイレクトは通常動作
- リダイレクトチェーン監視なし
- URLパラメータ漏洩が可能

**推奨対策**:
- redirect オプション制限
- リダイレクトチェーン長さ制限
- Referer パラメータ監視

---

## Statistics Update

| メトリクス | Phase 6 | Phase 7 | 増加 |
|----------|---------|---------|------|
| 攻撃シグネチャ | 74個 | 79個 | +5 (+6.7%) |
| Context Bridge 攻撃 | 6個 | 11個 | +5 |
| 検知ギャップ | 99.2% | 99.6% | +0.4% |

## Decision

Phase 7でContext Bridge攻撃（5個）を追加し、PlenoAuditの新たな脆弱性領域を拡大する。これにより：

1. ✅ クロスオリジンコンテキスト通信の悪用を実装
2. ✅ タイミング測定による情報推測を実証
3. ✅ キャッシュサイドチャネル攻撃を追加
4. ✅ WASM メモリレイアウト推測を実装
5. ✅ HTTPリダイレクト悪用を追加
6. ✅ 検知ギャップの拡大（99.2% → 99.6%）

## Consequences

- **Positive**: クロスオリジン通信層のセキュリティ脆弱性を特定
- **Positive**: タイミング系攻撃の新しい検知パターン開発に貢献
- **Positive**: キャッシュとメモリレイアウトの漏洩ベクトル明確化

- **Negative**: 攻撃複雑性の増加により検知対応が困難に
- **Negative**: 合法的なAPI (postMessage, Performance) の悪用は検知が難しい

## References

- [ADR 018: Battacker ハイブリッド攻撃シグネチャ](/docs/adr/018-battacker-hybrid-attacks.md)
- [ADR 017: Battacker 高度攻撃シグネチャ拡張](/docs/adr/017-battacker-advanced-signatures.md)
- [Phase 7 Report: Context Bridge Assessment](/docs/BATTACKER_PHASE7_REPORT.md)

---

**Phase 7 Completion**: 2026-01-17
**Total Attack Signatures**: 79
**Detection Gap Coverage**: 99.6%

