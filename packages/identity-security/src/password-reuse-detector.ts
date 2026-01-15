/**
 * @fileoverview Password Reuse Detector
 *
 * パスワード再利用を検出する。
 * ローカルストレージにハッシュのみを保存し、プライバシーを保護。
 *
 * 動作原理:
 * 1. パスワード入力時にハッシュを生成（SHA-256）
 * 2. 同じハッシュが複数のドメインで使用されていれば再利用と判定
 * 3. パスワード自体は一切保存しない
 */

// ============================================================================
// Types
// ============================================================================

/**
 * パスワードハッシュレコード
 */
export interface PasswordHashRecord {
  hash: string;
  domains: string[];
  firstSeenAt: number;
  lastSeenAt: number;
}

/**
 * 再利用検出結果
 */
export interface ReuseDetectionResult {
  isReused: boolean;
  reuseCount: number; // 何サイトで再利用されているか
  domains: string[]; // 再利用されているドメイン一覧（最大5件表示）
  severity: "critical" | "high" | "medium" | "none";
  message: string;
}

/**
 * パスワード再利用ストア
 */
export interface PasswordReuseStore {
  records: Map<string, PasswordHashRecord>;
}

// ============================================================================
// Hash Functions
// ============================================================================

/**
 * SHA-256ハッシュを生成（Web Crypto API使用）
 */
export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * 短縮ハッシュを生成（プライバシー向上のため先頭16文字のみ使用）
 * 衝突確率は上がるが、完全一致よりプライバシーが向上
 */
export async function hashPasswordShort(password: string): Promise<string> {
  const fullHash = await hashPassword(password);
  return fullHash.substring(0, 16);
}

// ============================================================================
// Reuse Detection
// ============================================================================

/**
 * パスワード再利用検出器
 */
export function createPasswordReuseDetector() {
  const store: PasswordReuseStore = {
    records: new Map(),
  };

  /**
   * パスワード使用を記録し、再利用をチェック
   */
  async function recordAndCheck(
    password: string,
    domain: string
  ): Promise<ReuseDetectionResult> {
    const hash = await hashPasswordShort(password);

    const existing = store.records.get(hash);
    const now = Date.now();

    if (existing) {
      // 既存のハッシュ - ドメインを追加
      if (!existing.domains.includes(domain)) {
        existing.domains.push(domain);
        existing.lastSeenAt = now;
      }

      const reuseCount = existing.domains.length;

      return {
        isReused: reuseCount > 1,
        reuseCount,
        domains: existing.domains.slice(0, 5),
        severity: getSeverity(reuseCount),
        message: getMessage(reuseCount, existing.domains),
      };
    } else {
      // 新規ハッシュ
      store.records.set(hash, {
        hash,
        domains: [domain],
        firstSeenAt: now,
        lastSeenAt: now,
      });

      return {
        isReused: false,
        reuseCount: 1,
        domains: [domain],
        severity: "none",
        message: "このパスワードは新規です",
      };
    }
  }

  /**
   * 再利用数から重大度を判定
   */
  function getSeverity(reuseCount: number): ReuseDetectionResult["severity"] {
    if (reuseCount >= 5) return "critical";
    if (reuseCount >= 3) return "high";
    if (reuseCount >= 2) return "medium";
    return "none";
  }

  /**
   * メッセージを生成
   */
  function getMessage(reuseCount: number, domains: string[]): string {
    if (reuseCount === 1) {
      return "このパスワードは新規です";
    }

    const displayDomains = domains.slice(0, 3).join(", ");
    const remaining = domains.length - 3;

    if (remaining > 0) {
      return `このパスワードは${reuseCount}つのサイトで使用されています: ${displayDomains}他${remaining}件`;
    }
    return `このパスワードは${reuseCount}つのサイトで使用されています: ${displayDomains}`;
  }

  /**
   * 特定ドメインのハッシュをチェック（記録なし）
   */
  async function checkOnly(
    password: string,
    _domain: string
  ): Promise<ReuseDetectionResult> {
    const hash = await hashPasswordShort(password);
    const existing = store.records.get(hash);

    if (existing && existing.domains.length > 1) {
      return {
        isReused: true,
        reuseCount: existing.domains.length,
        domains: existing.domains.slice(0, 5),
        severity: getSeverity(existing.domains.length),
        message: getMessage(existing.domains.length, existing.domains),
      };
    }

    return {
      isReused: false,
      reuseCount: existing?.domains.length || 0,
      domains: existing?.domains || [],
      severity: "none",
      message: "再利用は検出されませんでした",
    };
  }

  /**
   * 全レコードを取得
   */
  function getAllRecords(): PasswordHashRecord[] {
    return Array.from(store.records.values());
  }

  /**
   * 再利用されているパスワードの一覧を取得
   */
  function getReusedPasswords(): PasswordHashRecord[] {
    return Array.from(store.records.values()).filter(
      (r) => r.domains.length > 1
    );
  }

  /**
   * 統計情報を取得
   */
  function getStats(): {
    totalPasswords: number;
    reusedPasswords: number;
    highestReuseCount: number;
    affectedDomains: number;
  } {
    const records = Array.from(store.records.values());
    const reusedRecords = records.filter((r) => r.domains.length > 1);

    const affectedDomains = new Set<string>();
    for (const record of reusedRecords) {
      for (const domain of record.domains) {
        affectedDomains.add(domain);
      }
    }

    return {
      totalPasswords: records.length,
      reusedPasswords: reusedRecords.length,
      highestReuseCount: Math.max(0, ...records.map((r) => r.domains.length)),
      affectedDomains: affectedDomains.size,
    };
  }

  /**
   * レコードをクリア
   */
  function clear(): void {
    store.records.clear();
  }

  /**
   * ストアをインポート（永続化からの復元用）
   */
  function importRecords(records: PasswordHashRecord[]): void {
    for (const record of records) {
      store.records.set(record.hash, record);
    }
  }

  /**
   * ストアをエクスポート（永続化用）
   */
  function exportRecords(): PasswordHashRecord[] {
    return Array.from(store.records.values());
  }

  return {
    recordAndCheck,
    checkOnly,
    getAllRecords,
    getReusedPasswords,
    getStats,
    clear,
    importRecords,
    exportRecords,
  };
}

export type PasswordReuseDetector = ReturnType<typeof createPasswordReuseDetector>;
