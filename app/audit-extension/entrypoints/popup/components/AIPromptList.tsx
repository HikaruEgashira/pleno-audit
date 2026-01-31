import { useState } from "preact/hooks";
import type { CapturedAIPrompt } from "@pleno-audit/detectors";
import { Badge } from "../../../components";
import { usePopupStyles } from "../styles";
import { useTheme } from "../../../lib/theme";

function safeGetHostname(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url || "unknown";
  }
}

interface Props {
  prompts: CapturedAIPrompt[];
}

export function AIPromptList({ prompts }: Props) {
  const styles = usePopupStyles();
  const { colors } = useTheme();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (prompts.length === 0) {
    return (
      <div style={styles.section}>
        <p style={styles.emptyText}>AIプロンプトはまだキャプチャされていません</p>
      </div>
    );
  }

  return (
    <div style={styles.section}>
      <h3 style={styles.sectionTitle}>AIプロンプト ({prompts.length > 20000 ? "20000+" : prompts.length})</h3>
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        {prompts.slice(0, 20000).map((prompt) => (
          <PromptCard
            key={prompt.id}
            prompt={prompt}
            expanded={expandedId === prompt.id}
            onToggle={() =>
              setExpandedId(expandedId === prompt.id ? null : prompt.id)
            }
            styles={styles}
            colors={colors}
          />
        ))}
      </div>
    </div>
  );
}

function PromptCard({
  prompt,
  expanded,
  onToggle,
  styles,
  colors,
}: {
  prompt: CapturedAIPrompt;
  expanded: boolean;
  onToggle: () => void;
  styles: ReturnType<typeof usePopupStyles>;
  colors: any;
}) {
  const time = new Date(prompt.timestamp).toLocaleTimeString("ja-JP", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const preview = getPreview(prompt);
  const domain = safeGetHostname(prompt.apiEndpoint);
  const displayProvider = prompt.provider && prompt.provider !== "unknown" ? prompt.provider : domain;

  return (
    <div style={styles.card}>
      <div
        onClick={onToggle}
        style={{
          cursor: "pointer",
          display: "flex",
          flexDirection: "column",
          gap: "3px",
          alignItems: "stretch",
        }}
      >
        <div style={{ display: "flex", alignItems: "center" }}>
          <Badge variant="info">{displayProvider}</Badge>
          {prompt.model && (
            <code style={{ ...styles.code, marginLeft: "8px" }}>{prompt.model}</code>
          )}
          <span style={{ fontSize: "11px", color: colors.textSecondary, marginLeft: "auto" }}>{time}</span>
        </div>
        <p
          style={{
            fontSize: "12px",
            margin: 0,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            color: colors.textPrimary,
          }}
        >
          {preview}
        </p>
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
            <code style={styles.code}>{prompt.apiEndpoint}</code>
          </div>
          <div style={{ marginBottom: "8px" }}>
            <strong style={{ color: colors.textSecondary }}>プロンプト:</strong>
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
              {formatPrompt(prompt)}
            </pre>
          </div>
          {prompt.response && (
            <div>
              <strong style={{ color: colors.textSecondary }}>
                レスポンス{" "}
                {prompt.response.latencyMs && (
                  <Badge variant="success">{prompt.response.latencyMs}ms</Badge>
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
                {prompt.response.text || "(テキストなし)"}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function getPreview(prompt: CapturedAIPrompt): string {
  let text = "";
  if (prompt.prompt.messages?.length) {
    const last = [...prompt.prompt.messages]
      .reverse()
      .find((m) => m.role === "user");
    text = last?.content.substring(0, 80) || "";
  } else {
    text =
      prompt.prompt.text?.substring(0, 80) ||
      prompt.prompt.rawBody?.substring(0, 80) ||
      "";
  }

  return text || "(empty)";
}

function formatPrompt(prompt: CapturedAIPrompt): string {
  if (prompt.prompt.messages) {
    return prompt.prompt.messages
      .map((m) => `[${m.role}] ${m.content}`)
      .join("\n\n");
  }
  return prompt.prompt.text || prompt.prompt.rawBody || "";
}
