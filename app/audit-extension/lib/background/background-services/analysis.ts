import type { BackgroundServiceState } from "./state";
import type { PageAnalysis } from "./types";
import { DEFAULT_DETECTION_CONFIG } from "@pleno-audit/extension-runtime";
import { getAlertManager, checkDomainPolicy } from "./alerts";
import { addEvent } from "./events";
import { initStorage, updateService } from "./storage";

export async function handlePageAnalysis(state: BackgroundServiceState, analysis: PageAnalysis) {
  const { domain, login, privacy, tos, cookiePolicy, cookieBanner, timestamp, faviconUrl } = analysis;
  const storage = await initStorage();
  const detectionConfig = storage.detectionConfig || DEFAULT_DETECTION_CONFIG;
  const onNewDomain = (newDomain: string) => checkDomainPolicy(state, newDomain);

  if (faviconUrl) {
    await updateService(state, domain, { faviconUrl }, onNewDomain);
  }

  if (detectionConfig.enableLogin && (login.hasPasswordInput || login.isLoginUrl)) {
    await updateService(state, domain, { hasLoginPage: true }, onNewDomain);
    await addEvent(state, {
      type: "login_detected",
      domain,
      timestamp,
      details: login,
    });
  }

  if (detectionConfig.enablePrivacy && privacy.found && privacy.url) {
    await updateService(state, domain, { privacyPolicyUrl: privacy.url }, onNewDomain);
    await addEvent(state, {
      type: "privacy_policy_found",
      domain,
      timestamp,
      details: { url: privacy.url, method: privacy.method },
    });
  }

  if (detectionConfig.enableTos && tos.found && tos.url) {
    await updateService(state, domain, { termsOfServiceUrl: tos.url }, onNewDomain);
    await addEvent(state, {
      type: "terms_of_service_found",
      domain,
      timestamp,
      details: { url: tos.url, method: tos.method },
    });
  }

  if (cookiePolicy?.found && cookiePolicy.url) {
    await addEvent(state, {
      type: "cookie_policy_found",
      domain,
      timestamp,
      details: { url: cookiePolicy.url, method: cookiePolicy.method },
    });
  }

  if (cookieBanner?.found) {
    await addEvent(state, {
      type: "cookie_banner_detected",
      domain,
      timestamp,
      details: {
        selector: cookieBanner.selector,
        hasAcceptButton: cookieBanner.hasAcceptButton,
        hasRejectButton: cookieBanner.hasRejectButton,
        hasSettingsButton: cookieBanner.hasSettingsButton,
        isGDPRCompliant: cookieBanner.isGDPRCompliant,
      },
    });
  }

  const hasLoginForm = login.hasPasswordInput || login.isLoginUrl;
  const hasPrivacyPolicy = privacy.found;
  const hasTermsOfService = tos.found;
  const hasCookiePolicy = cookiePolicy?.found ?? false;
  const hasCookieBanner = cookieBanner?.found ?? false;
  const isCookieBannerGDPRCompliant = cookieBanner?.isGDPRCompliant ?? false;

  const hasViolations =
    (hasLoginForm && (!hasPrivacyPolicy || !hasTermsOfService)) ||
    !hasCookiePolicy ||
    !hasCookieBanner ||
    (hasCookieBanner && !isCookieBannerGDPRCompliant);

  if (hasViolations) {
    await getAlertManager(state).alertCompliance({
      pageDomain: domain,
      hasPrivacyPolicy,
      hasTermsOfService,
      hasCookiePolicy,
      hasCookieBanner,
      isCookieBannerGDPRCompliant,
      hasLoginForm,
    });
  }
}
