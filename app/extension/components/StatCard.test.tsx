import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/preact";
import { h } from "preact";
import { StatCard } from "./StatCard";
import { TestWrapper } from "../test-setup";

function renderWithTheme(ui: preact.VNode) {
  return render(h(TestWrapper, {}, ui));
}

describe("StatCard", () => {
  it("renders value and label", () => {
    renderWithTheme(h(StatCard, { value: 42, label: "Total Events" }));
    expect(screen.getByText("42")).toBeTruthy();
    expect(screen.getByText("Total Events")).toBeTruthy();
  });

  it("formats numeric values with locale string", () => {
    renderWithTheme(h(StatCard, { value: 1234567, label: "Count" }));
    // 1234567 should be formatted (e.g., "1,234,567")
    expect(screen.getByText("1,234,567")).toBeTruthy();
  });

  it("renders string values as-is", () => {
    renderWithTheme(h(StatCard, { value: "N/A", label: "Status" }));
    expect(screen.getByText("N/A")).toBeTruthy();
  });

  it("renders upward trend with arrow", () => {
    renderWithTheme(
      h(StatCard, {
        value: 100,
        label: "Alerts",
        trend: { value: 5, isUp: true },
      })
    );
    expect(screen.getByText(/↑/)).toBeTruthy();
    expect(screen.getByText(/5/)).toBeTruthy();
  });

  it("renders downward trend with arrow", () => {
    renderWithTheme(
      h(StatCard, {
        value: 100,
        label: "Alerts",
        trend: { value: 3, isUp: false },
      })
    );
    expect(screen.getByText(/↓/)).toBeTruthy();
    expect(screen.getByText(/3/)).toBeTruthy();
  });

  it("does not render trend when value is 0", () => {
    const { container } = renderWithTheme(
      h(StatCard, {
        value: 100,
        label: "Alerts",
        trend: { value: 0, isUp: true },
      })
    );
    // Trend should not be rendered when value is 0
    expect(container.textContent).not.toContain("↑");
    expect(container.textContent).not.toContain("↓");
  });

  it("calls onClick when clicked", () => {
    const handleClick = vi.fn();
    renderWithTheme(
      h(StatCard, { value: 42, label: "Clickable", onClick: handleClick })
    );

    fireEvent.click(screen.getByText("42"));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it("applies clickable styles when onClick is provided", () => {
    const { container } = renderWithTheme(
      h(StatCard, { value: 42, label: "Clickable", onClick: () => {} })
    );
    const card = container.querySelector("div");
    expect(card?.style.cursor).toBe("pointer");
  });

  it("does not apply clickable cursor when no onClick", () => {
    const { container } = renderWithTheme(
      h(StatCard, { value: 42, label: "Not Clickable" })
    );
    const card = container.querySelector("div");
    expect(card?.style.cursor).not.toBe("pointer");
  });

  it("has correct card styles", () => {
    const { container } = renderWithTheme(
      h(StatCard, { value: 42, label: "Styled" })
    );
    const card = container.querySelector("div");
    expect(card?.style.borderRadius).toBe("8px");
    expect(card?.style.padding).toBe("20px");
  });
});
