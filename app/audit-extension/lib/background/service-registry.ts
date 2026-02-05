import type {
  DetectedService,
  CookieInfo,
  LoginDetectedDetails,
  DetectionResult,
} from "@pleno-audit/detectors";
import type { AlertManager } from "@pleno-audit/alerts";
import type { DetectionConfig } from "@pleno-audit/extension-runtime";
import type { StorageData } from "./storage-access";
import type { NewEvent } from "./event-store";

interface LoggerLike {
  debug: (...args: unknown[]) => void;
}

interface ServiceRegistryDeps {
  logger: LoggerLike;
  initStorage: () => Promise<StorageData>;
  saveStorage: (data: Partial<StorageData>) => Promise<void>;
  queueStorageOperation: <T>(operation: () => Promise<T>) => Promise<T>;
  addEvent: (event: NewEvent) => Promise<unknown>;
  getAlertManager: () => AlertManager;
  checkDomainPolicy: (domain: string) => Promise<void>;
  defaultDetectionConfig: DetectionConfig;
}

export interface CookieBannerResult {
  found: boolean;
  selector: string | null;
  hasAcceptButton: boolean;
  hasRejectButton: boolean;
  hasSettingsButton: boolean;
  isGDPRCompliant: boolean;
}

export interface PageAnalysis {
  url: string;
  domain: string;
  timestamp: number;
  login: LoginDetectedDetails;
  privacy: DetectionResult;
  tos: DetectionResult;
  cookiePolicy?: DetectionResult;
  cookieBanner?: CookieBannerResult;
  faviconUrl?: string | null;
}

function createDefaultService(domain: string): DetectedService {
  return {
    domain,
    detectedAt: Date.now(),
    hasLoginPage: false,
    privacyPolicyUrl: null,
    termsOfServiceUrl: null,
    cookies: [],
  };
}

export function createServiceRegistry(deps: ServiceRegistryDeps) {
  async function updateService(domain: string, update: Partial<DetectedService>) {
    return deps.queueStorageOperation(async () => {
      const storage = await deps.initStorage();
      const isNewDomain = !storage.services[domain];
      const existing = storage.services[domain] || createDefaultService(domain);

      storage.services[domain] = {
        ...existing,
        ...update,
      };

      await deps.saveStorage({ services: storage.services });

      if (isNewDomain) {
        deps.checkDomainPolicy(domain).catch(() => {
          // Ignore policy check errors
        });
      }
    });
  }

  async function addCookieToService(domain: string, cookie: CookieInfo) {
    return deps.queueStorageOperation(async () => {
      const storage = await deps.initStorage();

      if (!storage.services[domain]) {
        storage.services[domain] = createDefaultService(domain);
      }

      const service = storage.services[domain];
      const exists = service.cookies.some((c) => c.name === cookie.name);
      if (!exists) {
        service.cookies.push(cookie);
      }

      await deps.saveStorage({ services: storage.services });
    });
  }

  async function handlePageAnalysis(analysis: PageAnalysis) {
    const { domain, login, privacy, tos, cookiePolicy, cookieBanner, timestamp, faviconUrl } = analysis;
    const storage = await deps.initStorage();
    const detectionConfig = storage.detectionConfig || deps.defaultDetectionConfig;

    if (faviconUrl) {
      await updateService(domain, { faviconUrl });
    }

    if (detectionConfig.enableLogin && (login.hasPasswordInput || login.isLoginUrl)) {
      await updateService(domain, { hasLoginPage: true });
      await deps.addEvent({
        type: "login_detected",
        domain,
        timestamp,
        details: login,
      });
    }

    if (detectionConfig.enablePrivacy && privacy.found && privacy.url) {
      await updateService(domain, { privacyPolicyUrl: privacy.url });
      await deps.addEvent({
        type: "privacy_policy_found",
        domain,
        timestamp,
        details: { url: privacy.url, method: privacy.method },
      });
    }

    if (detectionConfig.enableTos && tos.found && tos.url) {
      await updateService(domain, { termsOfServiceUrl: tos.url });
      await deps.addEvent({
        type: "terms_of_service_found",
        domain,
        timestamp,
        details: { url: tos.url, method: tos.method },
      });
    }

    if (cookiePolicy?.found && cookiePolicy.url) {
      await deps.addEvent({
        type: "cookie_policy_found",
        domain,
        timestamp,
        details: { url: cookiePolicy.url, method: cookiePolicy.method },
      });
    }

    if (cookieBanner?.found) {
      await deps.addEvent({
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
      await deps.getAlertManager().alertCompliance({
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

  return {
    updateService,
    addCookieToService,
    handlePageAnalysis,
  };
}
