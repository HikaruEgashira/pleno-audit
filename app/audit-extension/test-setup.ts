import "@testing-library/preact";
import { h } from "preact";
import { ThemeContext, lightColors } from "./lib/theme";

// Test wrapper with ThemeContext
export function TestWrapper({ children }: { children: preact.ComponentChildren }) {
  return h(ThemeContext.Provider, {
    value: {
      mode: "light",
      isDark: false,
      colors: lightColors,
      setMode: () => {},
    },
    children,
  });
}

// Mock chrome API for extension tests
globalThis.chrome = {
  storage: {
    local: {
      get: vi.fn().mockResolvedValue({}),
      set: vi.fn().mockResolvedValue(undefined),
      remove: vi.fn().mockResolvedValue(undefined),
    },
    sync: {
      get: vi.fn().mockResolvedValue({}),
      set: vi.fn().mockResolvedValue(undefined),
    },
    onChanged: {
      addListener: vi.fn(),
      removeListener: vi.fn(),
    },
  },
  runtime: {
    sendMessage: vi.fn().mockResolvedValue(undefined),
    onMessage: {
      addListener: vi.fn(),
      removeListener: vi.fn(),
    },
    getManifest: vi.fn().mockReturnValue({ version: "0.0.1" }),
  },
  tabs: {
    query: vi.fn().mockResolvedValue([]),
    sendMessage: vi.fn().mockResolvedValue(undefined),
  },
} as unknown as typeof chrome;

// Mock window.matchMedia
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});
