import { useTheme, fontSize } from "../lib/theme";

interface LoadingStateProps {
  message?: string;
}

export function LoadingState({ message = "読み込み中..." }: LoadingStateProps) {
  const { colors } = useTheme();

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "48px",
        fontSize: fontSize.lg,
        color: colors.textSecondary,
      }}
    >
      {message}
    </div>
  );
}
