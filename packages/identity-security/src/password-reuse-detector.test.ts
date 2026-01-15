import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  hashPassword,
  hashPasswordShort,
  createPasswordReuseDetector,
  type PasswordHashRecord,
} from "./password-reuse-detector.js";

// Mock crypto.subtle for Node.js environment
vi.stubGlobal("crypto", {
  subtle: {
    digest: async (_algorithm: string, data: ArrayBuffer) => {
      // Simple mock hash - just return bytes of the data padded to 32 bytes
      const dataArray = new Uint8Array(data);
      const result = new Uint8Array(32);
      for (let i = 0; i < dataArray.length && i < 32; i++) {
        result[i] = dataArray[i];
      }
      // Add some variation based on total length
      result[31] = dataArray.length;
      return result.buffer;
    },
  },
});

describe("hashPassword", () => {
  it("returns a 64-character hex string", async () => {
    const hash = await hashPassword("test123");
    expect(hash.length).toBe(64);
    expect(/^[0-9a-f]+$/.test(hash)).toBe(true);
  });

  it("returns different hashes for different passwords", async () => {
    const hash1 = await hashPassword("password1");
    const hash2 = await hashPassword("password2");
    expect(hash1).not.toBe(hash2);
  });

  it("returns same hash for same password", async () => {
    const hash1 = await hashPassword("samepassword");
    const hash2 = await hashPassword("samepassword");
    expect(hash1).toBe(hash2);
  });
});

describe("hashPasswordShort", () => {
  it("returns a 16-character hex string", async () => {
    const hash = await hashPasswordShort("test123");
    expect(hash.length).toBe(16);
    expect(/^[0-9a-f]+$/.test(hash)).toBe(true);
  });

  it("is a prefix of full hash", async () => {
    const shortHash = await hashPasswordShort("mypassword");
    const fullHash = await hashPassword("mypassword");
    expect(fullHash.startsWith(shortHash)).toBe(true);
  });
});

describe("createPasswordReuseDetector", () => {
  let detector: ReturnType<typeof createPasswordReuseDetector>;

  beforeEach(() => {
    detector = createPasswordReuseDetector();
  });

  describe("recordAndCheck", () => {
    it("returns isReused false for new password", async () => {
      const result = await detector.recordAndCheck("newpassword", "example.com");
      expect(result.isReused).toBe(false);
      expect(result.reuseCount).toBe(1);
      expect(result.severity).toBe("none");
    });

    it("detects reuse when same password used on different domains", async () => {
      await detector.recordAndCheck("sharedpassword", "site1.com");
      const result = await detector.recordAndCheck("sharedpassword", "site2.com");
      expect(result.isReused).toBe(true);
      expect(result.reuseCount).toBe(2);
      expect(result.domains).toContain("site1.com");
      expect(result.domains).toContain("site2.com");
    });

    it("does not duplicate domain in record", async () => {
      await detector.recordAndCheck("password", "same.com");
      await detector.recordAndCheck("password", "same.com");
      await detector.recordAndCheck("password", "same.com");
      const result = await detector.recordAndCheck("password", "same.com");
      expect(result.reuseCount).toBe(1);
      expect(result.isReused).toBe(false);
    });

    it("returns medium severity for 2 domains", async () => {
      await detector.recordAndCheck("pw", "a.com");
      const result = await detector.recordAndCheck("pw", "b.com");
      expect(result.severity).toBe("medium");
    });

    it("returns high severity for 3-4 domains", async () => {
      await detector.recordAndCheck("pw", "a.com");
      await detector.recordAndCheck("pw", "b.com");
      const result = await detector.recordAndCheck("pw", "c.com");
      expect(result.severity).toBe("high");
    });

    it("returns critical severity for 5+ domains", async () => {
      await detector.recordAndCheck("pw", "a.com");
      await detector.recordAndCheck("pw", "b.com");
      await detector.recordAndCheck("pw", "c.com");
      await detector.recordAndCheck("pw", "d.com");
      const result = await detector.recordAndCheck("pw", "e.com");
      expect(result.severity).toBe("critical");
    });

    it("limits displayed domains to 5", async () => {
      for (let i = 1; i <= 7; i++) {
        await detector.recordAndCheck("reused", `site${i}.com`);
      }
      const result = await detector.recordAndCheck("reused", "site8.com");
      expect(result.domains.length).toBe(5);
    });

    it("generates appropriate message for reused password", async () => {
      await detector.recordAndCheck("pw", "first.com");
      const result = await detector.recordAndCheck("pw", "second.com");
      expect(result.message).toContain("2つのサイト");
    });

    it("shows remaining count in message for many domains", async () => {
      await detector.recordAndCheck("pw", "a.com");
      await detector.recordAndCheck("pw", "b.com");
      await detector.recordAndCheck("pw", "c.com");
      await detector.recordAndCheck("pw", "d.com");
      const result = await detector.recordAndCheck("pw", "e.com");
      expect(result.message).toContain("他");
    });
  });

  describe("checkOnly", () => {
    it("does not record new passwords", async () => {
      await detector.checkOnly("newpw", "site.com");
      const records = detector.getAllRecords();
      expect(records.length).toBe(0);
    });

    it("detects existing reused password without modifying", async () => {
      await detector.recordAndCheck("pw", "a.com");
      await detector.recordAndCheck("pw", "b.com");
      const result = await detector.checkOnly("pw", "c.com");
      expect(result.isReused).toBe(true);
      expect(result.reuseCount).toBe(2); // Still 2, not 3
    });

    it("returns not reused for single-domain password", async () => {
      await detector.recordAndCheck("single", "only.com");
      const result = await detector.checkOnly("single", "another.com");
      expect(result.isReused).toBe(false);
    });
  });

  describe("getAllRecords", () => {
    it("returns empty array initially", () => {
      expect(detector.getAllRecords()).toEqual([]);
    });

    it("returns all recorded passwords", async () => {
      await detector.recordAndCheck("pw1", "site1.com");
      await detector.recordAndCheck("pw2", "site2.com");
      const records = detector.getAllRecords();
      expect(records.length).toBe(2);
    });
  });

  describe("getReusedPasswords", () => {
    it("returns empty array when no reuse", async () => {
      await detector.recordAndCheck("unique1", "site1.com");
      await detector.recordAndCheck("unique2", "site2.com");
      expect(detector.getReusedPasswords()).toEqual([]);
    });

    it("returns only reused passwords", async () => {
      await detector.recordAndCheck("unique", "site1.com");
      await detector.recordAndCheck("reused", "site2.com");
      await detector.recordAndCheck("reused", "site3.com");
      const reused = detector.getReusedPasswords();
      expect(reused.length).toBe(1);
      expect(reused[0].domains.length).toBe(2);
    });
  });

  describe("getStats", () => {
    it("returns zeros for empty detector", () => {
      const stats = detector.getStats();
      expect(stats.totalPasswords).toBe(0);
      expect(stats.reusedPasswords).toBe(0);
      expect(stats.highestReuseCount).toBe(0);
      expect(stats.affectedDomains).toBe(0);
    });

    it("calculates correct statistics", async () => {
      await detector.recordAndCheck("pw1", "a.com");
      await detector.recordAndCheck("pw1", "b.com");
      await detector.recordAndCheck("pw1", "c.com");
      await detector.recordAndCheck("pw2", "d.com");
      await detector.recordAndCheck("pw2", "e.com");
      await detector.recordAndCheck("unique", "f.com");

      const stats = detector.getStats();
      expect(stats.totalPasswords).toBe(3);
      expect(stats.reusedPasswords).toBe(2); // pw1 and pw2
      expect(stats.highestReuseCount).toBe(3); // pw1 used on 3 sites
      expect(stats.affectedDomains).toBe(5); // a,b,c,d,e (not f - unique is not affected)
    });
  });

  describe("clear", () => {
    it("removes all records", async () => {
      await detector.recordAndCheck("pw", "site.com");
      detector.clear();
      expect(detector.getAllRecords().length).toBe(0);
    });
  });

  describe("import/export", () => {
    it("exports records correctly", async () => {
      await detector.recordAndCheck("pw", "site1.com");
      await detector.recordAndCheck("pw", "site2.com");
      const exported = detector.exportRecords();
      expect(exported.length).toBe(1);
      expect(exported[0].domains.length).toBe(2);
    });

    it("imports records correctly", async () => {
      const records: PasswordHashRecord[] = [
        {
          hash: "abc123",
          domains: ["imported1.com", "imported2.com"],
          firstSeenAt: 1000,
          lastSeenAt: 2000,
        },
      ];
      detector.importRecords(records);
      const allRecords = detector.getAllRecords();
      expect(allRecords.length).toBe(1);
      expect(allRecords[0].domains).toContain("imported1.com");
    });

    it("merges with existing records on import", async () => {
      await detector.recordAndCheck("existing", "existing.com");
      const records: PasswordHashRecord[] = [
        {
          hash: "newhash",
          domains: ["imported.com"],
          firstSeenAt: 1000,
          lastSeenAt: 2000,
        },
      ];
      detector.importRecords(records);
      expect(detector.getAllRecords().length).toBe(2);
    });

    it("round-trips export/import correctly", async () => {
      await detector.recordAndCheck("pw1", "a.com");
      await detector.recordAndCheck("pw1", "b.com");
      await detector.recordAndCheck("pw2", "c.com");

      const exported = detector.exportRecords();
      const newDetector = createPasswordReuseDetector();
      newDetector.importRecords(exported);

      expect(newDetector.getAllRecords().length).toBe(2);
      expect(newDetector.getReusedPasswords().length).toBe(1);
    });
  });
});
