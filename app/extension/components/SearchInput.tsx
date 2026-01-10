import type { CSSProperties } from "preact/compat";

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

const style: CSSProperties = {
  padding: "8px 12px",
  border: "1px solid #eaeaea",
  borderRadius: "6px",
  fontSize: "13px",
  minWidth: "240px",
  outline: "none",
  transition: "border-color 0.15s",
  background: "#fff",
};

export function SearchInput({ value, onChange, placeholder = "検索..." }: SearchInputProps) {
  return (
    <input
      type="text"
      style={style}
      placeholder={placeholder}
      value={value}
      onInput={(e) => onChange((e.target as HTMLInputElement).value)}
      onFocus={(e) => ((e.target as HTMLInputElement).style.borderColor = "#000")}
      onBlur={(e) => ((e.target as HTMLInputElement).style.borderColor = "#eaeaea")}
    />
  );
}
