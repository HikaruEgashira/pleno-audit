import { useState } from "preact/hooks";
import type { CapturedAIPrompt } from "@service-policy-auditor/detectors";
import { styles } from "../styles";

interface Props {
  prompts: CapturedAIPrompt[];
}

export function AIPromptList({ prompts }: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (prompts.length === 0) {
    return (
      <div style={styles.section}>
        <p style={styles.emptyText}>No AI prompts captured yet</p>
      </div>
    );
  }

  return (
    <div style={styles.section}>
      <h3 style={styles.sectionTitle}>AI Prompts ({prompts.length})</h3>
      <div style={{ marginTop: "8px" }}>
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
        <p style={{ color: "hsl(0 0% 60%)", fontSize: "11px", marginTop: "8px" }}>
          Showing 50 of {prompts.length} prompts
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
  const time = new Date(prompt.timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const preview = getPreview(prompt);
  const showProvider = prompt.provider && prompt.provider !== "unknown";

  return (
    <div
      style={{
        border: "1px solid hsl(0 0% 90%)",
        borderRadius: "4px",
        marginBottom: "8px",
        backgroundColor: "hsl(0 0% 100%)",
      }}
    >
      <div
        onClick={onToggle}
        style={{
          padding: "8px 12px",
          cursor: "pointer",
          display: "flex",
          flexDirection: "column",
          gap: "4px",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          {showProvider && <span style={styles.badge}>{prompt.provider}</span>}
          <span style={{ fontSize: "11px", color: "hsl(0 0% 60%)", marginLeft: showProvider ? "0" : "auto" }}>{time}</span>
        </div>
        <p
          style={{
            fontSize: "12px",
            margin: 0,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            color: "hsl(0 0% 30%)",
          }}
        >
          {preview}
        </p>
      </div>

      {expanded && (
        <div
          style={{
            padding: "12px",
            borderTop: "1px solid hsl(0 0% 90%)",
            fontSize: "11px",
          }}
        >
          <div style={{ marginBottom: "8px" }}>
            <strong>Model:</strong> {prompt.model || "N/A"}
          </div>
          <div style={{ marginBottom: "8px" }}>
            <strong>Endpoint:</strong>{" "}
            <span style={styles.code}>{prompt.apiEndpoint}</span>
          </div>
          <div style={{ marginBottom: "8px" }}>
            <strong>Prompt:</strong>
            <pre
              style={{
                backgroundColor: "hsl(0 0% 95%)",
                padding: "8px",
                borderRadius: "4px",
                whiteSpace: "pre-wrap",
                maxHeight: "150px",
                overflow: "auto",
                fontSize: "11px",
                fontFamily: styles.fontMono,
                margin: "4px 0 0",
              }}
            >
              {formatPrompt(prompt)}
            </pre>
          </div>
          {prompt.response && (
            <div>
              <strong>
                Response{" "}
                {prompt.response.latencyMs && `(${prompt.response.latencyMs}ms)`}:
              </strong>
              <pre
                style={{
                  backgroundColor: "hsl(0 0% 95%)",
                  padding: "8px",
                  borderRadius: "4px",
                  whiteSpace: "pre-wrap",
                  maxHeight: "150px",
                  overflow: "auto",
                  fontSize: "11px",
                  fontFamily: styles.fontMono,
                  margin: "4px 0 0",
                }}
              >
                {prompt.response.text || "(No text)"}
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
