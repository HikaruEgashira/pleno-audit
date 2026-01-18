import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/preact";
import { h } from "preact";
import { Button } from "./Button";
import { TestWrapper } from "../test-setup";

function renderWithTheme(ui: preact.VNode) {
  return render(h(TestWrapper, {}, ui));
}

describe("Button", () => {
  it("renders children text", () => {
    renderWithTheme(h(Button, {}, "Click Me"));
    expect(screen.getByText("Click Me")).toBeTruthy();
  });

  it("calls onClick when clicked", () => {
    const handleClick = vi.fn();
    renderWithTheme(h(Button, { onClick: handleClick }, "Click"));

    fireEvent.click(screen.getByText("Click"));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it("does not call onClick when disabled", () => {
    const handleClick = vi.fn();
    renderWithTheme(h(Button, { onClick: handleClick, disabled: true }, "Disabled"));

    fireEvent.click(screen.getByText("Disabled"));
    expect(handleClick).not.toHaveBeenCalled();
  });

  it("applies disabled styles", () => {
    const { container } = renderWithTheme(
      h(Button, { disabled: true }, "Disabled")
    );
    const button = container.querySelector("button");
    expect(button?.disabled).toBe(true);
    expect(button?.style.opacity).toBe("0.5");
    expect(button?.style.cursor).toBe("not-allowed");
  });

  it("renders with primary variant", () => {
    const { container } = renderWithTheme(
      h(Button, { variant: "primary" }, "Primary")
    );
    const button = container.querySelector("button");
    expect(button).toBeTruthy();
  });

  it("renders with ghost variant", () => {
    const { container } = renderWithTheme(
      h(Button, { variant: "ghost" }, "Ghost")
    );
    const button = container.querySelector("button");
    expect(button?.style.background).toBe("transparent");
  });

  it("applies size styles correctly", () => {
    // Small size
    const { container: smContainer, unmount: unmountSm } = renderWithTheme(
      h(Button, { size: "sm" }, "Small")
    );
    const smButton = smContainer.querySelector("button");
    expect(smButton?.style.fontSize).toBe("12px");
    unmountSm();

    // Medium size (default)
    const { container: mdContainer } = renderWithTheme(
      h(Button, { size: "md" }, "Medium")
    );
    const mdButton = mdContainer.querySelector("button");
    expect(mdButton?.style.fontSize).toBe("13px");
  });

  it("has correct base styles", () => {
    const { container } = renderWithTheme(h(Button, {}, "Base"));
    const button = container.querySelector("button");
    expect(button?.style.display).toBe("inline-flex");
    expect(button?.style.borderRadius).toBe("6px");
    expect(button?.style.cursor).toBe("pointer");
  });
});
