import { isSessionCookie, type CookieInfo } from "@pleno-audit/detectors";

export type CookieChangeCallback = (cookie: CookieInfo, removed: boolean) => void;

let listeners: CookieChangeCallback[] = [];
let isStarted = false;

export function startCookieMonitor() {
  if (isStarted) {
    return;
  }

  isStarted = true;

  chrome.cookies.onChanged.addListener((changeInfo) => {
    const { cookie, removed } = changeInfo;

    if (!isSessionCookie(cookie.name)) {
      return;
    }

    const cookieInfo: CookieInfo = {
      name: cookie.name,
      domain: cookie.domain,
      detectedAt: Date.now(),
      isSession: !cookie.expirationDate,
    };

    for (const listener of listeners) {
      listener(cookieInfo, removed);
    }
  });
}

export function onCookieChange(callback: CookieChangeCallback) {
  listeners.push(callback);
  return () => {
    listeners = listeners.filter((l) => l !== callback);
  };
}
