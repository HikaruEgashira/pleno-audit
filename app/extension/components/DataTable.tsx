import type { CSSProperties } from "preact/compat";
import { useState, useMemo } from "preact/hooks";
import { useTheme, type ThemeColors } from "../lib/theme";

interface Column<T> {
  key: string;
  header: string;
  width?: string;
  render: (item: T) => preact.ComponentChildren;
}

interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  pageSize?: number;
  emptyMessage?: string;
  rowKey: (item: T, index: number) => string;
  rowHighlight?: (item: T) => boolean;
}

function getStyles(colors: ThemeColors, isDark: boolean): Record<string, CSSProperties> {
  return {
    container: {
      background: colors.bgPrimary,
      border: `1px solid ${colors.border}`,
      borderRadius: "8px",
      overflow: "hidden",
    },
    table: {
      width: "100%",
      borderCollapse: "collapse",
      fontSize: "13px",
    },
    th: {
      background: colors.bgSecondary,
      borderBottom: `1px solid ${colors.border}`,
      padding: "12px 16px",
      textAlign: "left",
      fontSize: "12px",
      fontWeight: 500,
      color: colors.textSecondary,
    },
    td: {
      padding: "12px 16px",
      borderBottom: `1px solid ${colors.borderLight}`,
      color: colors.textPrimary,
    },
    row: {
      transition: "background 0.1s",
    },
    rowHighlight: {
      background: isDark ? "#3d3a0a" : "#fffbe6",
    },
    empty: {
      padding: "48px",
      textAlign: "center",
      color: colors.textMuted,
      fontSize: "14px",
    },
    pagination: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      padding: "12px 16px",
      borderTop: `1px solid ${colors.border}`,
      background: colors.bgSecondary,
    },
    pageInfo: {
      fontSize: "13px",
      color: colors.textSecondary,
    },
    pageButtons: {
      display: "flex",
      gap: "8px",
    },
    pageBtn: {
      padding: "6px 12px",
      border: `1px solid ${colors.border}`,
      borderRadius: "6px",
      background: colors.bgPrimary,
      fontSize: "12px",
      color: colors.textPrimary,
      cursor: "pointer",
    },
    pageBtnDisabled: {
      padding: "6px 12px",
      border: `1px solid ${colors.border}`,
      borderRadius: "6px",
      background: colors.bgSecondary,
      fontSize: "12px",
      color: colors.textMuted,
      cursor: "not-allowed",
    },
  };
}

export function DataTable<T>({
  data,
  columns,
  pageSize = 25,
  emptyMessage = "データがありません",
  rowKey,
  rowHighlight,
}: DataTableProps<T>) {
  const { colors, isDark } = useTheme();
  const styles = getStyles(colors, isDark);
  const [page, setPage] = useState(0);

  const totalPages = Math.ceil(data.length / pageSize);
  const paginated = useMemo(
    () => data.slice(page * pageSize, (page + 1) * pageSize),
    [data, page, pageSize]
  );

  if (data.length === 0) {
    return (
      <div style={styles.container}>
        <p style={styles.empty}>{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <table style={styles.table}>
        <thead>
          <tr>
            {columns.map((col) => (
              <th key={col.key} style={{ ...styles.th, width: col.width }}>
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {paginated.map((item, i) => (
            <tr
              key={rowKey(item, i)}
              style={{
                ...styles.row,
                ...(rowHighlight?.(item) ? styles.rowHighlight : {}),
              }}
            >
              {columns.map((col) => (
                <td key={col.key} style={styles.td}>
                  {col.render(item)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {totalPages > 1 && (
        <div style={styles.pagination}>
          <span style={styles.pageInfo}>
            {page * pageSize + 1}-{Math.min((page + 1) * pageSize, data.length)} / {data.length}件
          </span>
          <div style={styles.pageButtons}>
            <button
              style={page === 0 ? styles.pageBtnDisabled : styles.pageBtn}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
            >
              前へ
            </button>
            <button
              style={page >= totalPages - 1 ? styles.pageBtnDisabled : styles.pageBtn}
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
            >
              次へ
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
