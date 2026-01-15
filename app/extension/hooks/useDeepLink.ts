import { useState, useEffect, useCallback } from "preact/hooks";

interface DeepLinkState {
  tab?: string;
  period?: string;
  search?: string;
  filter?: string;
  [key: string]: string | undefined;
}

/**
 * ディープリンク管理フック
 * URLハッシュを使用して状態を永続化・共有可能にする
 *
 * 例: #overview?period=7d&search=google
 */
export function useDeepLink<T extends DeepLinkState>(
  defaultState: T,
  validTabs?: string[]
): {
  state: T;
  updateState: (updates: Partial<T>) => void;
  setTab: (tab: string) => void;
  getShareableUrl: () => string;
} {
  const parseHash = useCallback((): T => {
    const hash = window.location.hash.slice(1);
    if (!hash) return defaultState;

    const [tabPart, queryPart] = hash.split("?");
    const params = new URLSearchParams(queryPart || "");

    const result: DeepLinkState = { ...defaultState };

    // タブの解析
    if (tabPart) {
      if (!validTabs || validTabs.includes(tabPart)) {
        result.tab = tabPart;
      }
    }

    // クエリパラメータの解析
    params.forEach((value, key) => {
      if (key in defaultState) {
        result[key] = value;
      }
    });

    return result as T;
  }, [defaultState, validTabs]);

  const [state, setState] = useState<T>(parseHash);

  const buildHash = useCallback((newState: T): string => {
    const { tab, ...params } = newState;
    const queryParams = new URLSearchParams();

    Object.entries(params).forEach(([key, value]) => {
      if (value && value !== defaultState[key as keyof T]) {
        queryParams.set(key, value);
      }
    });

    const queryString = queryParams.toString();
    return tab ? (queryString ? `${tab}?${queryString}` : tab) : "";
  }, [defaultState]);

  const updateState = useCallback(
    (updates: Partial<T>) => {
      setState((prev) => {
        const newState = { ...prev, ...updates };
        const hash = buildHash(newState);
        window.location.hash = hash;
        return newState;
      });
    },
    [buildHash]
  );

  const setTab = useCallback(
    (tab: string) => {
      updateState({ tab } as Partial<T>);
    },
    [updateState]
  );

  const getShareableUrl = useCallback(() => {
    const baseUrl = window.location.href.split("#")[0];
    const hash = buildHash(state);
    return hash ? `${baseUrl}#${hash}` : baseUrl;
  }, [state, buildHash]);

  // ハッシュ変更の監視
  useEffect(() => {
    const handleHashChange = () => {
      setState(parseHash());
    };

    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, [parseHash]);

  return {
    state,
    updateState,
    setTab,
    getShareableUrl,
  };
}

/**
 * URLをクリップボードにコピー
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // フォールバック
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    const success = document.execCommand("copy");
    document.body.removeChild(textarea);
    return success;
  }
}
