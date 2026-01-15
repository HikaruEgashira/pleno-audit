import { describe, it, expect, vi } from "vitest";
import { createLoginDetector } from "./login-detector.js";
import type { DOMAdapter } from "./types.js";

function createMockDOMAdapter(options: {
  passwordInputs?: Array<{ closest: (selector: string) => unknown }>;
  location?: { origin: string; pathname: string; href: string };
}): DOMAdapter {
  const {
    passwordInputs = [],
    location = { origin: "https://example.com", pathname: "/", href: "https://example.com/" },
  } = options;

  return {
    querySelector: vi.fn(() => null),
    querySelectorAll: vi.fn(() => passwordInputs as unknown as NodeListOf<Element>),
    getLocation: vi.fn(() => location),
  };
}

describe("createLoginDetector", () => {
  describe("detectLoginPage", () => {
    it("returns all false for page without password input", () => {
      const dom = createMockDOMAdapter({});
      const detector = createLoginDetector(dom);
      const result = detector.detectLoginPage();

      expect(result.hasPasswordInput).toBe(false);
      expect(result.hasLoginForm).toBe(false);
      expect(result.isLoginUrl).toBe(false);
      expect(result.formAction).toBeNull();
    });

    it("detects password input", () => {
      const dom = createMockDOMAdapter({
        passwordInputs: [{ closest: () => null }],
      });
      const detector = createLoginDetector(dom);
      const result = detector.detectLoginPage();

      expect(result.hasPasswordInput).toBe(true);
      expect(result.hasLoginForm).toBe(false);
    });

    it("detects login form with password input", () => {
      const mockForm = { action: "https://example.com/auth" };
      const dom = createMockDOMAdapter({
        passwordInputs: [{ closest: () => mockForm }],
      });
      const detector = createLoginDetector(dom);
      const result = detector.detectLoginPage();

      expect(result.hasPasswordInput).toBe(true);
      expect(result.hasLoginForm).toBe(true);
      expect(result.formAction).toBe("https://example.com/auth");
    });

    it("handles form without action attribute", () => {
      const mockForm = { action: "" };
      const dom = createMockDOMAdapter({
        passwordInputs: [{ closest: () => mockForm }],
      });
      const detector = createLoginDetector(dom);
      const result = detector.detectLoginPage();

      expect(result.hasLoginForm).toBe(true);
      expect(result.formAction).toBeNull();
    });

    it("detects login URL pattern", () => {
      const dom = createMockDOMAdapter({
        location: {
          origin: "https://example.com",
          pathname: "/login",
          href: "https://example.com/login",
        },
      });
      const detector = createLoginDetector(dom);
      const result = detector.detectLoginPage();

      expect(result.isLoginUrl).toBe(true);
    });

    it("detects signin URL pattern", () => {
      const dom = createMockDOMAdapter({
        location: {
          origin: "https://example.com",
          pathname: "/signin",
          href: "https://example.com/signin",
        },
      });
      const detector = createLoginDetector(dom);
      const result = detector.detectLoginPage();

      expect(result.isLoginUrl).toBe(true);
    });

    it("detects auth URL pattern", () => {
      const dom = createMockDOMAdapter({
        location: {
          origin: "https://example.com",
          pathname: "/auth",
          href: "https://example.com/auth",
        },
      });
      const detector = createLoginDetector(dom);
      const result = detector.detectLoginPage();

      expect(result.isLoginUrl).toBe(true);
    });

    it("detects account URL pattern", () => {
      const dom = createMockDOMAdapter({
        location: {
          origin: "https://example.com",
          pathname: "/account/login",
          href: "https://example.com/account/login",
        },
      });
      const detector = createLoginDetector(dom);
      const result = detector.detectLoginPage();

      expect(result.isLoginUrl).toBe(true);
    });

    it("does not detect non-login URL", () => {
      const dom = createMockDOMAdapter({
        location: {
          origin: "https://example.com",
          pathname: "/about",
          href: "https://example.com/about",
        },
      });
      const detector = createLoginDetector(dom);
      const result = detector.detectLoginPage();

      expect(result.isLoginUrl).toBe(false);
    });

    it("handles multiple password inputs", () => {
      const mockForm = { action: "https://example.com/register" };
      const dom = createMockDOMAdapter({
        passwordInputs: [
          { closest: () => mockForm },
          { closest: () => mockForm },
        ],
      });
      const detector = createLoginDetector(dom);
      const result = detector.detectLoginPage();

      expect(result.hasPasswordInput).toBe(true);
      expect(result.hasLoginForm).toBe(true);
    });

    it("combines password input and login URL detection", () => {
      const mockForm = { action: "https://example.com/auth/submit" };
      const dom = createMockDOMAdapter({
        passwordInputs: [{ closest: () => mockForm }],
        location: {
          origin: "https://example.com",
          pathname: "/login",
          href: "https://example.com/login",
        },
      });
      const detector = createLoginDetector(dom);
      const result = detector.detectLoginPage();

      expect(result.hasPasswordInput).toBe(true);
      expect(result.hasLoginForm).toBe(true);
      expect(result.isLoginUrl).toBe(true);
      expect(result.formAction).toBe("https://example.com/auth/submit");
    });
  });

  describe("isLoginPage", () => {
    it("returns false for regular page", () => {
      const dom = createMockDOMAdapter({});
      const detector = createLoginDetector(dom);

      expect(detector.isLoginPage()).toBe(false);
    });

    it("returns true when password input exists", () => {
      const dom = createMockDOMAdapter({
        passwordInputs: [{ closest: () => null }],
      });
      const detector = createLoginDetector(dom);

      expect(detector.isLoginPage()).toBe(true);
    });

    it("returns true when URL indicates login", () => {
      const dom = createMockDOMAdapter({
        location: {
          origin: "https://example.com",
          pathname: "/login",
          href: "https://example.com/login",
        },
      });
      const detector = createLoginDetector(dom);

      expect(detector.isLoginPage()).toBe(true);
    });

    it("returns true when both password input and login URL exist", () => {
      const mockForm = { action: "https://example.com/auth" };
      const dom = createMockDOMAdapter({
        passwordInputs: [{ closest: () => mockForm }],
        location: {
          origin: "https://example.com",
          pathname: "/signin",
          href: "https://example.com/signin",
        },
      });
      const detector = createLoginDetector(dom);

      expect(detector.isLoginPage()).toBe(true);
    });

    it("returns false for page with form but no password", () => {
      const dom = createMockDOMAdapter({
        passwordInputs: [],
        location: {
          origin: "https://example.com",
          pathname: "/contact",
          href: "https://example.com/contact",
        },
      });
      const detector = createLoginDetector(dom);

      expect(detector.isLoginPage()).toBe(false);
    });
  });

  describe("URL pattern detection", () => {
    const loginPaths = [
      "/login",
      "/signin",
      "/sign-in",
      "/auth",
      "/authenticate",
      "/account/login",
      "/user/login",
      "/members/signin",
    ];

    loginPaths.forEach((path) => {
      it(`detects ${path} as login URL`, () => {
        const dom = createMockDOMAdapter({
          location: {
            origin: "https://example.com",
            pathname: path,
            href: `https://example.com${path}`,
          },
        });
        const detector = createLoginDetector(dom);
        const result = detector.detectLoginPage();

        expect(result.isLoginUrl).toBe(true);
      });
    });

    const nonLoginPaths = [
      "/",
      "/home",
      "/about",
      "/products",
      "/contact",
      "/blog",
      "/pricing",
    ];

    nonLoginPaths.forEach((path) => {
      it(`does not detect ${path} as login URL`, () => {
        const dom = createMockDOMAdapter({
          location: {
            origin: "https://example.com",
            pathname: path,
            href: `https://example.com${path}`,
          },
        });
        const detector = createLoginDetector(dom);
        const result = detector.detectLoginPage();

        expect(result.isLoginUrl).toBe(false);
      });
    });
  });
});
