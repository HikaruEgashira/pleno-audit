# ADR-012: Dashboard データ取得の設計原則

## ステータス
Accepted

## コンテキスト
Dashboard で統計値が500で頭打ちになる、0になる、Invalid Date が表示されるなどのバグが発生した。
根本原因分析の結果、以下の問題が特定された：

1. 統計値（COUNT）とデータ一覧を同じソースから計算していた
2. APIの仕様（期間フィルタの有無）を確認せずに使用した
3. 複数API呼び出し時の障害分離ができていなかった

## 決定

### 1. 統計値とデータ一覧の分離

統計値（カウント）は必ず専用のAPIまたはレスポンスの`total`フィールドから取得する。
データ一覧の`.length`を統計値として使用しない。

```typescript
// BAD: データ一覧の長さを統計値に使用
const violations = await getViolations({ limit: 500 });
setCount(violations.length); // 最大500になってしまう

// GOOD: APIのtotalフィールドを使用
const result = await getViolations({ limit: 500 });
setCount(result.total); // 正確なカウント
setData(result.violations); // 表示用データ
```

### 2. API呼び出しの障害分離

複数のAPIを並列呼び出しする場合、個別にエラーハンドリングを行う。
1つのAPIの失敗が他のAPIの結果に影響しないようにする。

```typescript
// BAD: Promise.allで一括処理（1つ失敗すると全体が失敗）
const [a, b, c] = await Promise.all([apiA(), apiB(), apiC()]);

// GOOD: 個別にエラーハンドリング
const safeCall = async <T>(fn: () => Promise<T>, fallback: T): Promise<T> => {
  try {
    return await fn() ?? fallback;
  } catch {
    return fallback;
  }
};

const [a, b, c] = await Promise.all([
  safeCall(apiA, defaultA),
  safeCall(apiB, defaultB),
  safeCall(apiC, defaultC),
]);
```

### 3. APIレスポンス型の明示

APIのレスポンス型を明示的に定義し、期間フィルタの対応有無をドキュメント化する。

| API | 期間フィルタ | 戻り値 |
|-----|-------------|--------|
| GET_CSP_REPORTS | ✅ since/until | `{ reports, total, hasMore }` |
| GET_STATS | ❌ 全期間のみ | `{ violations, requests, uniqueDomains }` |
| GET_EVENTS | ✅ since/until | `{ events, total, hasMore }` |
| GET_EVENTS_COUNT | ✅ since/until | `{ count }` |

## 結果

- 統計値が正確に表示される
- 1つのAPIの障害が全体に波及しない
- APIの仕様が明確になり、誤用を防げる
