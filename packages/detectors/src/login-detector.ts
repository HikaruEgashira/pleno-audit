import { isLoginUrl } from "./patterns.js";
import type { DOMAdapter, LoginDetectionResult } from "./types.js";

export function createLoginDetector(dom: DOMAdapter) {
  function detectLoginPage(): LoginDetectionResult {
    const passwordInputs = dom.querySelectorAll('input[type="password"]');
    const hasPasswordInput = passwordInputs.length > 0;

    let formAction: string | null = null;
    let hasLoginForm = false;

    if (hasPasswordInput) {
      const form = passwordInputs[0]?.closest("form");
      if (form) {
        hasLoginForm = true;
        formAction = (form as HTMLFormElement).action || null;
      }
    }

    const currentUrl = dom.getLocation().href;
    const urlIndicatesLogin = isLoginUrl(currentUrl);

    return {
      hasLoginForm,
      hasPasswordInput,
      isLoginUrl: urlIndicatesLogin,
      formAction,
    };
  }

  function isLoginPage(): boolean {
    const result = detectLoginPage();
    return result.hasPasswordInput || result.isLoginUrl;
  }

  return {
    detectLoginPage,
    isLoginPage,
  };
}
