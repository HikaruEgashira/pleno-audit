import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/preact";
import { h } from "preact";
import { NetworkMonitorSettings } from "../entrypoints/popup/components/NetworkMonitorSettings";
import { TestWrapper } from "../test-setup";

function renderWithTheme(ui: preact.VNode) {
  return render(h(TestWrapper, {}, ui));
}

// Mock sendMessage
const mockSendMessage = vi.fn();
vi.mock("../entrypoints/popup/utils/messaging", () => ({
  sendMessage: (msg: { type: string; data?: unknown }) => mockSendMessage(msg),
}));

describe("NetworkMonitorSettings", () => {
  const mockConfig = {
    enabled: true,
    captureAllRequests: false,
    excludeOwnExtension: true,
    excludedDomains: [],
    excludedExtensions: [],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockSendMessage.mockResolvedValue(mockConfig);
  });

  it("renders null when config is not loaded", () => {
    mockSendMessage.mockImplementation(() => new Promise(() => {})); // Never resolves
    const { container } = renderWithTheme(h(NetworkMonitorSettings, {}));
    expect(container.innerHTML).toBe("");
  });

  it("loads config on mount", async () => {
    renderWithTheme(h(NetworkMonitorSettings, {}));

    await waitFor(() => {
      expect(mockSendMessage).toHaveBeenCalledWith({
        type: "GET_NETWORK_MONITOR_CONFIG",
      });
    });
  });

  it("displays correct enabled count", async () => {
    renderWithTheme(h(NetworkMonitorSettings, {}));

    await waitFor(() => {
      // enabled: true, captureAllRequests: false, excludeOwnExtension: true = 2/3
      expect(screen.getByText("Network Monitor (2/3)")).toBeTruthy();
    });
  });

  it("expands options when header is clicked", async () => {
    renderWithTheme(h(NetworkMonitorSettings, {}));

    await waitFor(() => {
      expect(screen.getByText("Network Monitor (2/3)")).toBeTruthy();
    });

    // Click header to expand
    const header = screen.getByText("Network Monitor (2/3)").closest("div");
    if (header) {
      fireEvent.click(header);
    }

    await waitFor(() => {
      expect(screen.getByText("ネットワーク監視")).toBeTruthy();
      expect(screen.getByText("全リクエスト")).toBeTruthy();
      expect(screen.getByText("自身を除外")).toBeTruthy();
    });
  });

  it("displays option descriptions", async () => {
    renderWithTheme(h(NetworkMonitorSettings, {}));

    await waitFor(() => {
      expect(screen.getByText("Network Monitor (2/3)")).toBeTruthy();
    });

    // Expand
    const header = screen.getByText("Network Monitor (2/3)").closest("div");
    if (header) {
      fireEvent.click(header);
    }

    await waitFor(() => {
      expect(screen.getByText("全リクエストを監視")).toBeTruthy();
      expect(screen.getByText("拡張機能以外も記録")).toBeTruthy();
      expect(screen.getByText("Pleno Auditを除外")).toBeTruthy();
    });
  });

  it("toggles option when checkbox is clicked", async () => {
    renderWithTheme(h(NetworkMonitorSettings, {}));

    await waitFor(() => {
      expect(screen.getByText("Network Monitor (2/3)")).toBeTruthy();
    });

    // Expand
    const header = screen.getByText("Network Monitor (2/3)").closest("div");
    if (header) {
      fireEvent.click(header);
    }

    await waitFor(() => {
      expect(screen.getByText("ネットワーク監視")).toBeTruthy();
    });

    // Find and click the first checkbox
    const checkboxes = screen.getAllByRole("checkbox");
    expect(checkboxes.length).toBe(3);

    // Toggle the "enabled" checkbox
    fireEvent.click(checkboxes[0]);

    await waitFor(() => {
      expect(mockSendMessage).toHaveBeenCalledWith({
        type: "SET_NETWORK_MONITOR_CONFIG",
        data: expect.objectContaining({
          enabled: false, // Toggled from true to false
        }),
      });
    });
  });

  it("shows checkmarks for enabled options", async () => {
    renderWithTheme(h(NetworkMonitorSettings, {}));

    await waitFor(() => {
      expect(screen.getByText("Network Monitor (2/3)")).toBeTruthy();
    });

    // Expand
    const header = screen.getByText("Network Monitor (2/3)").closest("div");
    if (header) {
      fireEvent.click(header);
    }

    await waitFor(() => {
      const checkboxes = screen.getAllByRole("checkbox") as HTMLInputElement[];
      // enabled: true
      expect(checkboxes[0].checked).toBe(true);
      // captureAllRequests: false
      expect(checkboxes[1].checked).toBe(false);
      // excludeOwnExtension: true
      expect(checkboxes[2].checked).toBe(true);
    });
  });

  it("handles sendMessage error gracefully", async () => {
    mockSendMessage.mockRejectedValue(new Error("Network error"));

    // Should not throw
    const { container } = renderWithTheme(h(NetworkMonitorSettings, {}));

    // Component renders but shows nothing since config failed to load
    await waitFor(() => {
      expect(container.innerHTML).toBe("");
    });
  });

  it("exports DNRSettings as alias", async () => {
    const { DNRSettings } = await import("../entrypoints/popup/components/NetworkMonitorSettings");
    expect(DNRSettings).toBe(NetworkMonitorSettings);
  });
});
