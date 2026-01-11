import { useState } from "preact/hooks";
import type { CapturedInput } from "@pleno-audit/detectors";
import { Badge } from "../../../components";
import { usePopupStyles } from "../styles";
import { useTheme } from "../../../lib/theme";

interface Props {
  inputs: CapturedInput[];
}

export function InputList({ inputs }: Props) {
  const styles = usePopupStyles();
  const { colors } = useTheme();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (inputs.length === 0) {
    return (
      <div style={styles.section}>
        <p style={styles.emptyText}>Inputsはまだキャプチャされていません</p>
      </div>
    );
  }

  return (
    <div style={styles.section}>
      <h3 style={styles.sectionTitle}>Inputs ({inputs.length})</h3>
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        {inputs.slice(0, 50).map((input) => (
          <InputCard
            key={input.id}
            input={input}
            expanded={expandedId === input.id}
            onToggle={() =>
              setExpandedId(expandedId === input.id ? null : input.id)
            }
            styles={styles}
            colors={colors}
          />
        ))}
      </div>
      {inputs.length > 50 && (
        <p style={{ color: colors.textMuted, fontSize: "11px", marginTop: "8px" }}>
          50件中{inputs.length}件を表示
        </p>
      )}
    </div>
  );
}

function InputCard({
  input,
  expanded,
  onToggle,
  styles,
  colors,
}: {
  input: CapturedInput;
  expanded: boolean;
  onToggle: () => void;
  styles: ReturnType<typeof usePopupStyles>;
  colors: ReturnType<typeof useTheme>["colors"];
}) {
  const time = new Date(input.timestamp).toLocaleTimeString("ja-JP", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const preview = getPreview(input);

  return (
    <div style={styles.card}>
      <div
        onClick={onToggle}
        style={{
          cursor: "pointer",
          display: "flex",
          flexDirection: "row",
          gap: "6px",
          alignItems: "center",
        }}
      >
        {input.isAI && (
          <Badge variant="info" size="sm">AI</Badge>
        )}
        <p
          style={{
            fontSize: "12px",
            margin: 0,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            color: colors.textPrimary,
            flex: 1,
          }}
        >
          {preview}
        </p>
        <span style={{ fontSize: "11px", color: colors.textSecondary, flexShrink: 0 }}>{time}</span>
      </div>

      {expanded && (
        <div
          style={{
            marginTop: "12px",
            paddingTop: "12px",
            borderTop: `1px solid ${colors.border}`,
            fontSize: "12px",
          }}
        >
          <div style={{ marginBottom: "8px" }}>
            <strong style={{ color: colors.textSecondary }}>エンドポイント:</strong>{" "}
            <code style={styles.code}>{input.apiEndpoint}</code>
          </div>
          <div style={{ marginBottom: "8px" }}>
            <strong style={{ color: colors.textSecondary }}>コンテンツ:</strong>
            <pre
              style={{
                backgroundColor: colors.bgSecondary,
                padding: "10px",
                borderRadius: "6px",
                whiteSpace: "pre-wrap",
                maxHeight: "150px",
                overflow: "auto",
                fontSize: "11px",
                fontFamily: "monospace",
                margin: "6px 0 0",
                border: `1px solid ${colors.border}`,
                color: colors.textPrimary,
              }}
            >
              {formatContent(input)}
            </pre>
          </div>
          {input.response && (
            <div>
              <strong style={{ color: colors.textSecondary }}>
                レスポンス{" "}
                {input.response.latencyMs && (
                  <Badge variant="success">{input.response.latencyMs}ms</Badge>
                )}
              </strong>
              <pre
                style={{
                  backgroundColor: colors.bgSecondary,
                  padding: "10px",
                  borderRadius: "6px",
                  whiteSpace: "pre-wrap",
                  maxHeight: "150px",
                  overflow: "auto",
                  fontSize: "11px",
                  fontFamily: "monospace",
                  margin: "6px 0 0",
                  border: `1px solid ${colors.border}`,
                  color: colors.textPrimary,
                }}
              >
                {input.response.text || "(テキストなし)"}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function getPreview(input: CapturedInput): string {
  if (input.content.messages?.length) {
    const last = [...input.content.messages]
      .reverse()
      .find((m) => m.role === "user");
    return last?.content.substring(0, 100) || "";
  }
  return (
    input.content.text?.substring(0, 100) ||
    input.content.rawBody?.substring(0, 100) ||
    ""
  );
}

function formatContent(input: CapturedInput): string {
  if (input.content.messages) {
    return input.content.messages
      .map((m) => `[${m.role}] ${m.content}`)
      .join("\n\n");
  }
  return input.content.text || input.content.rawBody || "";
}
