import type { CSSProperties } from "preact/compat";
import { useTheme } from "../lib/theme";

interface SelectProps {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
}

export function Select({ value, onChange, options, placeholder }: SelectProps) {
  const { colors } = useTheme();

  const style: CSSProperties = {
    padding: "8px 12px",
    border: `1px solid ${colors.border}`,
    borderRadius: "6px",
    fontSize: "13px",
    background: colors.bgPrimary,
    color: colors.textPrimary,
    cursor: "pointer",
    outline: "none",
    minWidth: "120px",
  };

  return (
    <select
      style={style}
      value={value}
      onChange={(e) => onChange((e.target as HTMLSelectElement).value)}
    >
      {placeholder && <option value="">{placeholder}</option>}
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}
