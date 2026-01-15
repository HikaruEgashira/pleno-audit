import { describe, it, expect } from "vitest";
import {
  analyzePassword,
  hasCommonWeakPattern,
  hasSequentialChars,
  hasRepeatedChars,
  scoreToStrength,
  isStrongPassword,
  meetsMinimumRequirements,
} from "./password-analyzer.js";

describe("analyzePassword", () => {
  describe("strength evaluation", () => {
    it("rates very short password as very_weak", () => {
      const result = analyzePassword("abc");
      expect(result.strength).toBe("very_weak");
      expect(result.score).toBeLessThan(20);
    });

    it("rates simple password as weak", () => {
      const result = analyzePassword("password");
      expect(result.strength).toBe("very_weak");
    });

    it("rates medium password as strong or better", () => {
      // MyPass123 has lowercase, uppercase, numbers = 3 char types + length bonus
      const result = analyzePassword("MyPass123");
      expect(["strong", "very_strong"]).toContain(result.strength);
    });

    it("rates good password as strong", () => {
      const result = analyzePassword("MyStr0ng!Pass");
      expect(["strong", "very_strong"]).toContain(result.strength);
    });

    it("rates excellent password as very_strong", () => {
      const result = analyzePassword("C0mpl3x!P@ssw0rd#2024");
      expect(result.strength).toBe("very_strong");
    });
  });

  describe("checks evaluation", () => {
    it("detects lowercase letters", () => {
      const result = analyzePassword("abcdefgh");
      expect(result.checks.lowercase).toBe(true);
      expect(result.checks.uppercase).toBe(false);
    });

    it("detects uppercase letters", () => {
      const result = analyzePassword("ABCDEFGH");
      expect(result.checks.uppercase).toBe(true);
      expect(result.checks.lowercase).toBe(false);
    });

    it("detects numbers", () => {
      const result = analyzePassword("12345678");
      expect(result.checks.numbers).toBe(true);
    });

    it("detects symbols", () => {
      const result = analyzePassword("!@#$%^&*");
      expect(result.checks.symbols).toBe(true);
    });

    it("detects sufficient length", () => {
      const result = analyzePassword("abcdefgh");
      expect(result.checks.length).toBe(true);
    });

    it("flags insufficient length", () => {
      const result = analyzePassword("abc");
      expect(result.checks.length).toBe(false);
    });
  });

  describe("issues detection", () => {
    it("detects too short password", () => {
      const result = analyzePassword("ab");
      expect(result.issues.some((i) => i.type === "too_short")).toBe(true);
    });

    it("detects short password", () => {
      const result = analyzePassword("abcdefg");
      expect(result.issues.some((i) => i.type === "short")).toBe(true);
    });

    it("detects single char type", () => {
      const result = analyzePassword("abcdefghij");
      expect(result.issues.some((i) => i.type === "single_char_type")).toBe(true);
    });

    it("detects common pattern", () => {
      const result = analyzePassword("password");
      expect(result.issues.some((i) => i.type === "common_pattern")).toBe(true);
      expect(result.issues.find((i) => i.type === "common_pattern")?.severity).toBe("critical");
    });

    it("detects sequential chars", () => {
      const result = analyzePassword("myabcdefpass");
      expect(result.issues.some((i) => i.type === "sequential_chars")).toBe(true);
    });

    it("detects repeated chars", () => {
      const result = analyzePassword("myaaaaapass");
      expect(result.issues.some((i) => i.type === "repeated_chars")).toBe(true);
    });
  });

  describe("suggestions generation", () => {
    it("suggests adding length", () => {
      const result = analyzePassword("Ab1!");
      expect(result.suggestions.some((s) => s.includes("8文字"))).toBe(true);
    });

    it("suggests adding uppercase", () => {
      const result = analyzePassword("abcd1234!");
      expect(result.suggestions.some((s) => s.includes("大文字"))).toBe(true);
    });

    it("suggests adding symbols", () => {
      const result = analyzePassword("Abcd1234");
      expect(result.suggestions.some((s) => s.includes("記号"))).toBe(true);
    });

    it("gives general suggestion for strong passwords", () => {
      const result = analyzePassword("C0mpl3x!P@ssw0rd#2024");
      expect(result.suggestions.some((s) => s.includes("定期的"))).toBe(true);
    });
  });
});

describe("hasCommonWeakPattern", () => {
  it("detects numeric-only passwords", () => {
    expect(hasCommonWeakPattern("123456")).toBe(true);
    expect(hasCommonWeakPattern("000000")).toBe(true);
  });

  it("detects common word passwords", () => {
    expect(hasCommonWeakPattern("password")).toBe(true);
    expect(hasCommonWeakPattern("PASSWORD")).toBe(true);
    expect(hasCommonWeakPattern("admin")).toBe(true);
    expect(hasCommonWeakPattern("letmein")).toBe(true);
    expect(hasCommonWeakPattern("welcome")).toBe(true);
  });

  it("detects keyboard patterns", () => {
    expect(hasCommonWeakPattern("qwerty")).toBe(true);
    expect(hasCommonWeakPattern("asdfgh")).toBe(true);
    expect(hasCommonWeakPattern("zxcvbn")).toBe(true);
  });

  it("detects year patterns", () => {
    expect(hasCommonWeakPattern("2024")).toBe(true);
    expect(hasCommonWeakPattern("1990")).toBe(true);
  });

  it("detects repeated single chars", () => {
    expect(hasCommonWeakPattern("aaaa")).toBe(true);
    expect(hasCommonWeakPattern("1111")).toBe(true);
  });

  it("does not flag complex passwords", () => {
    expect(hasCommonWeakPattern("MyC0mpl3x!Pass")).toBe(false);
    expect(hasCommonWeakPattern("Xk9#mPq2")).toBe(false);
  });
});

describe("hasSequentialChars", () => {
  it("detects alphabetic sequences", () => {
    expect(hasSequentialChars("myabcdpass", 4)).toBe(true);
    expect(hasSequentialChars("xyzdef", 3)).toBe(true);
  });

  it("detects numeric sequences", () => {
    expect(hasSequentialChars("my1234pass", 4)).toBe(true);
    expect(hasSequentialChars("pass9876end", 4)).toBe(true);
  });

  it("detects keyboard sequences", () => {
    expect(hasSequentialChars("myqwerpass", 4)).toBe(true);
    expect(hasSequentialChars("asdfghpass", 4)).toBe(true);
  });

  it("does not flag short sequences", () => {
    expect(hasSequentialChars("myabcpass", 4)).toBe(false);
    expect(hasSequentialChars("my123pass", 4)).toBe(false);
  });

  it("does not flag random passwords", () => {
    expect(hasSequentialChars("Xk9#mPq2Rw", 4)).toBe(false);
  });

  it("respects minLength parameter", () => {
    expect(hasSequentialChars("abc", 3)).toBe(true);
    expect(hasSequentialChars("abc", 4)).toBe(false);
  });
});

describe("hasRepeatedChars", () => {
  it("detects repeated letters", () => {
    expect(hasRepeatedChars("paaaaass", 3)).toBe(true);
    expect(hasRepeatedChars("helllo", 3)).toBe(true);
  });

  it("detects repeated numbers", () => {
    expect(hasRepeatedChars("pass111word", 3)).toBe(true);
    expect(hasRepeatedChars("99999", 3)).toBe(true);
  });

  it("detects repeated symbols", () => {
    expect(hasRepeatedChars("pass!!!word", 3)).toBe(true);
    expect(hasRepeatedChars("test@@@end", 3)).toBe(true);
  });

  it("does not flag short repeats", () => {
    expect(hasRepeatedChars("pass11word", 3)).toBe(false);
    expect(hasRepeatedChars("hello", 3)).toBe(false);
  });

  it("does not flag varied passwords", () => {
    expect(hasRepeatedChars("C0mpl3x!Pass", 3)).toBe(false);
  });

  it("respects minRepeat parameter", () => {
    expect(hasRepeatedChars("aaa", 3)).toBe(true);
    expect(hasRepeatedChars("aaa", 4)).toBe(false);
  });

  it("handles short passwords", () => {
    expect(hasRepeatedChars("ab", 3)).toBe(false);
  });
});

describe("scoreToStrength", () => {
  it("returns very_weak for score < 20", () => {
    expect(scoreToStrength(0)).toBe("very_weak");
    expect(scoreToStrength(19)).toBe("very_weak");
  });

  it("returns weak for score 20-39", () => {
    expect(scoreToStrength(20)).toBe("weak");
    expect(scoreToStrength(39)).toBe("weak");
  });

  it("returns fair for score 40-59", () => {
    expect(scoreToStrength(40)).toBe("fair");
    expect(scoreToStrength(59)).toBe("fair");
  });

  it("returns strong for score 60-79", () => {
    expect(scoreToStrength(60)).toBe("strong");
    expect(scoreToStrength(79)).toBe("strong");
  });

  it("returns very_strong for score >= 80", () => {
    expect(scoreToStrength(80)).toBe("very_strong");
    expect(scoreToStrength(100)).toBe("very_strong");
  });
});

describe("isStrongPassword", () => {
  it("returns true for strong passwords", () => {
    expect(isStrongPassword("MyStr0ng!P@ss")).toBe(true);
    expect(isStrongPassword("C0mpl3x!P@ssw0rd#2024")).toBe(true);
  });

  it("returns false for weak passwords", () => {
    expect(isStrongPassword("password")).toBe(false);
    expect(isStrongPassword("123456")).toBe(false);
    expect(isStrongPassword("abc")).toBe(false);
  });
});

describe("meetsMinimumRequirements", () => {
  it("returns true for fair or better passwords", () => {
    expect(meetsMinimumRequirements("MyPass123")).toBe(true);
    expect(meetsMinimumRequirements("StrongP@ss1")).toBe(true);
  });

  it("returns false for very weak or weak passwords", () => {
    expect(meetsMinimumRequirements("123")).toBe(false);
    expect(meetsMinimumRequirements("password")).toBe(false);
  });
});
