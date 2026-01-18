import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/preact";
import { h } from "preact";
import { Card } from "./Card";
import { TestWrapper } from "../test-setup";

function renderWithTheme(ui: preact.VNode) {
  return render(h(TestWrapper, {}, ui));
}

describe("Card", () => {
  it("renders children content", () => {
    renderWithTheme(h(Card, {}, "Test content"));
    expect(screen.getByText("Test content")).toBeTruthy();
  });

  it("renders title when provided", () => {
    renderWithTheme(h(Card, { title: "Card Title" }, "Content"));
    expect(screen.getByText("Card Title")).toBeTruthy();
    expect(screen.getByText("Content")).toBeTruthy();
  });

  it("does not render title when not provided", () => {
    const { container } = renderWithTheme(h(Card, {}, "Only content"));
    // Only one div should exist (the card itself), not a title div
    const divs = container.querySelectorAll("div");
    expect(divs.length).toBe(1);
  });

  it("applies default medium padding", () => {
    const { container } = renderWithTheme(h(Card, {}, "Content"));
    const card = container.querySelector("div");
    expect(card?.style.padding).toBe("16px");
  });

  it("applies small padding", () => {
    const { container } = renderWithTheme(h(Card, { padding: "sm" }, "Content"));
    const card = container.querySelector("div");
    expect(card?.style.padding).toBe("12px");
  });

  it("applies large padding", () => {
    const { container } = renderWithTheme(h(Card, { padding: "lg" }, "Content"));
    const card = container.querySelector("div");
    expect(card?.style.padding).toBe("24px");
  });

  it("has correct border radius", () => {
    const { container } = renderWithTheme(h(Card, {}, "Content"));
    const card = container.querySelector("div");
    expect(card?.style.borderRadius).toBe("8px");
  });
});
