import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/preact";
import { h } from "preact";
import { ErrorState, parseErrorMessage } from "./ErrorState";
import { TestWrapper } from "../test-setup";

function renderWithTheme(ui: preact.VNode) {
  return render(h(TestWrapper, {}, ui));
}

describe("ErrorState", () => {
  it("renders with default unknown error type", () => {
    renderWithTheme(h(ErrorState, {}));
    expect(screen.getByText("エラーが発生しました")).toBeTruthy();
  });

  it("renders connection error", () => {
    renderWithTheme(h(ErrorState, { type: "connection" }));
    expect(screen.getByText("接続エラー")).toBeTruthy();
    expect(screen.getByText(/拡張機能との接続に失敗しました/)).toBeTruthy();
  });

  it("renders database error", () => {
    renderWithTheme(h(ErrorState, { type: "database" }));
    expect(screen.getByText("データベースエラー")).toBeTruthy();
  });

  it("renders permission error", () => {
    renderWithTheme(h(ErrorState, { type: "permission" }));
    expect(screen.getByText("権限エラー")).toBeTruthy();
  });

  it("renders timeout error", () => {
    renderWithTheme(h(ErrorState, { type: "timeout" }));
    expect(screen.getByText("タイムアウト")).toBeTruthy();
  });

  it("renders with custom title and message", () => {
    renderWithTheme(
      h(ErrorState, {
        title: "カスタムタイトル",
        message: "カスタムメッセージ",
      })
    );
    expect(screen.getByText("カスタムタイトル")).toBeTruthy();
    expect(screen.getByText("カスタムメッセージ")).toBeTruthy();
  });

  it("renders retry button when onRetry provided", () => {
    const onRetry = vi.fn();
    renderWithTheme(h(ErrorState, { onRetry }));

    const retryButton = screen.getByText("再試行");
    expect(retryButton).toBeTruthy();

    fireEvent.click(retryButton);
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("renders help button when onHelp provided", () => {
    const onHelp = vi.fn();
    renderWithTheme(h(ErrorState, { onHelp }));

    const helpButton = screen.getByText("ヘルプ");
    expect(helpButton).toBeTruthy();

    fireEvent.click(helpButton);
    expect(onHelp).toHaveBeenCalledOnce();
  });

  it("renders both buttons when both callbacks provided", () => {
    const onRetry = vi.fn();
    const onHelp = vi.fn();
    renderWithTheme(h(ErrorState, { onRetry, onHelp }));

    expect(screen.getByText("再試行")).toBeTruthy();
    expect(screen.getByText("ヘルプ")).toBeTruthy();
  });

  it("renders technical details when provided", () => {
    renderWithTheme(
      h(ErrorState, { technicalDetails: "Error: Something went wrong" })
    );
    expect(screen.getByText("技術的な詳細")).toBeTruthy();
    expect(screen.getByText("Error: Something went wrong")).toBeTruthy();
  });

  it("does not render buttons when callbacks not provided", () => {
    renderWithTheme(h(ErrorState, {}));
    expect(screen.queryByText("再試行")).toBeNull();
    expect(screen.queryByText("ヘルプ")).toBeNull();
  });

  it("centers content", () => {
    const { container } = renderWithTheme(h(ErrorState, {}));
    const wrapper = container.querySelector("div");
    expect(wrapper?.style.textAlign).toBe("center");
    expect(wrapper?.style.alignItems).toBe("center");
  });
});

describe("parseErrorMessage", () => {
  it("detects timeout errors", () => {
    expect(parseErrorMessage(new Error("Connection timeout"))).toEqual({
      type: "timeout",
      technicalDetails: "Connection timeout",
    });
    expect(parseErrorMessage("ready timeout")).toEqual({
      type: "timeout",
      technicalDetails: "ready timeout",
    });
  });

  it("detects permission errors", () => {
    expect(parseErrorMessage(new Error("Permission denied"))).toEqual({
      type: "permission",
      technicalDetails: "Permission denied",
    });
  });

  it("detects database errors", () => {
    expect(parseErrorMessage(new Error("Database not initialized"))).toEqual({
      type: "database",
      technicalDetails: "Database not initialized",
    });
    expect(parseErrorMessage("SQL error")).toEqual({
      type: "database",
      technicalDetails: "SQL error",
    });
    expect(parseErrorMessage("storage quota exceeded")).toEqual({
      type: "database",
      technicalDetails: "storage quota exceeded",
    });
  });

  it("detects connection errors", () => {
    expect(parseErrorMessage(new Error("Connection refused"))).toEqual({
      type: "connection",
      technicalDetails: "Connection refused",
    });
    expect(parseErrorMessage("network error")).toEqual({
      type: "connection",
      technicalDetails: "network error",
    });
    expect(parseErrorMessage("fetch failed")).toEqual({
      type: "connection",
      technicalDetails: "fetch failed",
    });
  });

  it("returns unknown for unrecognized errors", () => {
    expect(parseErrorMessage(new Error("Something went wrong"))).toEqual({
      type: "unknown",
      technicalDetails: "Something went wrong",
    });
  });

  it("handles non-Error objects", () => {
    expect(parseErrorMessage("string error")).toEqual({
      type: "unknown",
      technicalDetails: "string error",
    });
    expect(parseErrorMessage(123)).toEqual({
      type: "unknown",
      technicalDetails: "123",
    });
  });
});
