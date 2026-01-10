import { useState } from "preact/hooks";
import type { CapturedAIPrompt } from "@service-policy-auditor/detectors";
import { Badge, Card } from "../../../components";
import { styles } from "../styles";

interface Props {
  prompts: CapturedAIPrompt[];
}

export function AIPromptList({ prompts }: Props) {
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
      <h3 style={styles.sectionTitle}>AIプロンプト ({prompts.length})</h3>
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        {prompts.slice(0, 50).map((prompt) => (
          <PromptCard
            key={prompt.id}
            prompt={prompt}
            expanded={expandedId === prompt.id}
            onToggle={() =>
              setExpandedId(expandedId === prompt.id ? null : prompt.id)
            }
          />
        ))}
      </div>
      {prompts.length > 50 && (
        <p style={{ color: "#999", fontSize: "11px", marginTop: "8px" }}>
          50件中{prompts.length}件を表示
        </p>
      )}
    </div>
  );
}

function PromptCard({
  prompt,
  expanded,
  onToggle,
}: {
  prompt: CapturedAIPrompt;
  expanded: boolean;
  onToggle: () => void;
}) {
  const time = new Date(prompt.timestamp).toLocaleTimeString("ja-JP", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const preview = getPreview(prompt);
  const showProvider = prompt.provider && prompt.provider !== "unknown";

  return (
    <div style={styles.card}>
      <div
        onClick={onToggle}
        style={{
          cursor: "pointer",
          display: "flex",
          flexDirection: showProvider ? "column" : "row",
          gap: "6px",
          alignItems: showProvider ? "stretch" : "center",
        }}
      >
        {showProvider && (
          <div style={{ display: "flex", alignItems: "center" }}>
            <Badge variant="info">{prompt.provider}</Badge>
            {prompt.model && (
              <code style={{ ...styles.code, marginLeft: "8px" }}>{prompt.model}</code>
            )}
            <span style={{ fontSize: "11px", color: "#666", marginLeft: "auto" }}>{time}</span>
          </div>
        )}
        <p
          style={{
            fontSize: "12px",
            margin: 0,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            color: "#333",
            flex: showProvider ? undefined : 1,
          }}
        >
          {preview}
        </p>
        {!showProvider && (
          <span style={{ fontSize: "11px", color: "#666", flexShrink: 0 }}>{time}</span>
        )}
      </div>

      {expanded && (
        <div
          style={{
            marginTop: "12px",
            paddingTop: "12px",
            borderTop: "1px solid #eaeaea",
            fontSize: "12px",
          }}
        >
          <div style={{ marginBottom: "8px" }}>
            <strong style={{ color: "#666" }}>エンドポイント:</strong>{" "}
            <code style={styles.code}>{prompt.apiEndpoint}</code>
          </div>
          <div style={{ marginBottom: "8px" }}>
            <strong style={{ color: "#666" }}>プロンプト:</strong>
            <pre
              style={{
                backgroundColor: "#fafafa",
                padding: "10px",
                borderRadius: "6px",
                whiteSpace: "pre-wrap",
                maxHeight: "150px",
                overflow: "auto",
                fontSize: "11px",
                fontFamily: "monospace",
                margin: "6px 0 0",
                border: "1px solid #eaeaea",
              }}
            >
              {formatPrompt(prompt)}
            </pre>
          </div>
          {prompt.response && (
            <div>
              <strong style={{ color: "#666" }}>
                レスポンス{" "}
                {prompt.response.latencyMs && (
                  <Badge variant="success">{prompt.response.latencyMs}ms</Badge>
                )}
              </strong>
              <pre
                style={{
                  backgroundColor: "#fafafa",
                  padding: "10px",
                  borderRadius: "6px",
                  whiteSpace: "pre-wrap",
                  maxHeight: "150px",
                  overflow: "auto",
                  fontSize: "11px",
                  fontFamily: "monospace",
                  margin: "6px 0 0",
                  border: "1px solid #eaeaea",
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
  if (prompt.prompt.messages?.length) {
    const last = [...prompt.prompt.messages]
      .reverse()
      .find((m) => m.role === "user");
    return last?.content.substring(0, 100) || "";
  }
  return (
    prompt.prompt.text?.substring(0, 100) ||
    prompt.prompt.rawBody?.substring(0, 100) ||
    ""
  );
}

function formatPrompt(prompt: CapturedAIPrompt): string {
  if (prompt.prompt.messages) {
    return prompt.prompt.messages
      .map((m) => `[${m.role}] ${m.content}`)
      .join("\n\n");
  }
  return prompt.prompt.text || prompt.prompt.rawBody || "";
}
