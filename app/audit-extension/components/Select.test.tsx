import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/preact";
import { h } from "preact";
import { Select } from "./Select";
import { TestWrapper } from "../test-setup";

function renderWithTheme(ui: preact.VNode) {
  return render(h(TestWrapper, {}, ui));
}

const sampleOptions = [
  { value: "option1", label: "Option 1" },
  { value: "option2", label: "Option 2" },
  { value: "option3", label: "Option 3" },
];

describe("Select", () => {
  it("renders all options", () => {
    renderWithTheme(
      h(Select, {
        value: "",
        onChange: () => {},
        options: sampleOptions,
      })
    );

    expect(screen.getByText("Option 1")).toBeTruthy();
    expect(screen.getByText("Option 2")).toBeTruthy();
    expect(screen.getByText("Option 3")).toBeTruthy();
  });

  it("renders placeholder when provided", () => {
    renderWithTheme(
      h(Select, {
        value: "",
        onChange: () => {},
        options: sampleOptions,
        placeholder: "Select an option",
      })
    );

    expect(screen.getByText("Select an option")).toBeTruthy();
  });

  it("does not render placeholder when not provided", () => {
    renderWithTheme(
      h(Select, {
        value: "",
        onChange: () => {},
        options: sampleOptions,
      })
    );

    // Should only have 3 options, not 4
    const select = screen.getByRole("combobox");
    expect(select.querySelectorAll("option").length).toBe(3);
  });

  it("calls onChange with selected value", () => {
    const handleChange = vi.fn();
    renderWithTheme(
      h(Select, {
        value: "option1",
        onChange: handleChange,
        options: sampleOptions,
      })
    );

    const select = screen.getByRole("combobox");
    fireEvent.change(select, { target: { value: "option2" } });
    expect(handleChange).toHaveBeenCalledWith("option2");
  });

  it("shows correct selected value", () => {
    renderWithTheme(
      h(Select, {
        value: "option2",
        onChange: () => {},
        options: sampleOptions,
      })
    );

    const select = screen.getByRole("combobox") as HTMLSelectElement;
    expect(select.value).toBe("option2");
  });

  it("has correct styles", () => {
    const { container } = renderWithTheme(
      h(Select, {
        value: "",
        onChange: () => {},
        options: sampleOptions,
      })
    );

    const select = container.querySelector("select");
    expect(select?.style.borderRadius).toBe("6px");
    expect(select?.style.cursor).toBe("pointer");
    expect(select?.style.minWidth).toBe("120px");
  });

  it("renders empty options list", () => {
    renderWithTheme(
      h(Select, {
        value: "",
        onChange: () => {},
        options: [],
        placeholder: "No options",
      })
    );

    const select = screen.getByRole("combobox");
    // Only placeholder option
    expect(select.querySelectorAll("option").length).toBe(1);
  });
});
