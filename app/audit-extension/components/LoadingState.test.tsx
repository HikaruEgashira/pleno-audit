import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/preact";
import { h } from "preact";
import { LoadingState } from "./LoadingState";
import { TestWrapper } from "../test-setup";

function renderWithTheme(ui: preact.VNode) {
  return render(h(TestWrapper, {}, ui));
}

describe("LoadingState", () => {
  it("renders with default message", () => {
    renderWithTheme(h(LoadingState, {}));
    expect(screen.getByText("読み込み中...")).toBeTruthy();
  });

  it("renders with custom message", () => {
    renderWithTheme(h(LoadingState, { message: "データを取得中..." }));
    expect(screen.getByText("データを取得中...")).toBeTruthy();
  });

  it("centers content", () => {
    const { container } = renderWithTheme(h(LoadingState, {}));
    const wrapper = container.querySelector("div");
    expect(wrapper?.style.display).toBe("flex");
    expect(wrapper?.style.alignItems).toBe("center");
    expect(wrapper?.style.justifyContent).toBe("center");
  });

  it("applies padding", () => {
    const { container } = renderWithTheme(h(LoadingState, {}));
    const wrapper = container.querySelector("div");
    expect(wrapper?.style.padding).toBe("48px");
  });
});
