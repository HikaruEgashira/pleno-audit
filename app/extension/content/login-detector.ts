import { isLoginUrl } from "@ai-service-exposure/core";

export interface LoginDetectionResult {
  hasLoginForm: boolean;
  hasPasswordInput: boolean;
  isLoginUrl: boolean;
  formAction: string | null;
}

export function detectLoginPage(): LoginDetectionResult {
  const passwordInputs = document.querySelectorAll('input[type="password"]');
  const hasPasswordInput = passwordInputs.length > 0;

  let formAction: string | null = null;
  let hasLoginForm = false;

  if (hasPasswordInput) {
    const form = passwordInputs[0]?.closest("form");
    if (form) {
      hasLoginForm = true;
      formAction = form.action || null;
    }
  }

  const currentUrl = window.location.href;
  const urlIndicatesLogin = isLoginUrl(currentUrl);

  return {
    hasLoginForm,
    hasPasswordInput,
    isLoginUrl: urlIndicatesLogin,
    formAction,
  };
}

export function isLoginPage(): boolean {
  const result = detectLoginPage();
  return result.hasPasswordInput || result.isLoginUrl;
}
