import {
  DEFAULT_NRD_CONFIG,
  DEFAULT_TYPOSQUAT_CONFIG,
  createNRDDetector,
  createTyposquatDetector,
  type NRDCache,
  type NRDConfig,
  type NRDResult,
  type TyposquatCache,
  type TyposquatConfig,
  type TyposquatResult,
  type DetectedService,
} from "@pleno-audit/detectors";
import { nrdResultToParquetRecord, typosquatResultToParquetRecord } from "@pleno-audit/parquet-storage";
import type { AlertManager } from "@pleno-audit/alerts";
import type { DetectionConfig } from "@pleno-audit/extension-runtime";
import type { StorageData } from "./storage-access";
import type { NewEvent } from "./event-store";

interface LoggerLike {
  error: (...args: unknown[]) => void;
}

interface RiskDetectionDeps {
  logger: LoggerLike;
  initStorage: () => Promise<StorageData>;
  getStorage: () => Promise<{ nrdConfig?: NRDConfig; typosquatConfig?: TyposquatConfig }>;
  setStorage: (data: { nrdConfig?: NRDConfig; typosquatConfig?: TyposquatConfig }) => Promise<void>;
  updateService: (domain: string, update: Partial<DetectedService>) => Promise<void>;
  addEvent: (event: NewEvent) => Promise<unknown>;
  getAlertManager: () => AlertManager;
  getOrInitParquetStore: () => Promise<{ write: (table: string, records: unknown[]) => Promise<void> }>;
  defaultDetectionConfig: DetectionConfig;
}

export function createRiskDetectionService(deps: RiskDetectionDeps) {
  const nrdCache: Map<string, NRDResult> = new Map();
  let nrdDetector: ReturnType<typeof createNRDDetector> | null = null;

  const nrdCacheAdapter: NRDCache = {
    get: (domain) => nrdCache.get(domain) ?? null,
    set: (domain, result) => nrdCache.set(domain, result),
    clear: () => nrdCache.clear(),
  };

  const typosquatCache: Map<string, TyposquatResult> = new Map();
  let typosquatDetector: ReturnType<typeof createTyposquatDetector> | null = null;

  const typosquatCacheAdapter: TyposquatCache = {
    get: (domain) => typosquatCache.get(domain) ?? null,
    set: (domain, result) => typosquatCache.set(domain, result),
    clear: () => typosquatCache.clear(),
  };

  async function getNRDConfig(): Promise<NRDConfig> {
    const storage = await deps.getStorage();
    return storage.nrdConfig || DEFAULT_NRD_CONFIG;
  }

  async function initNRDDetector() {
    const config = await getNRDConfig();
    nrdDetector = createNRDDetector(config, nrdCacheAdapter);
  }

  async function checkNRD(domain: string): Promise<NRDResult> {
    if (!nrdDetector) {
      await initNRDDetector();
    }
    return nrdDetector!.checkDomain(domain);
  }

  async function handleNRDCheck(domain: string): Promise<NRDResult | { skipped: true; reason: string }> {
    try {
      const storage = await deps.initStorage();
      const detectionConfig = storage.detectionConfig || deps.defaultDetectionConfig;

      if (!detectionConfig.enableNRD) {
        return { skipped: true, reason: "NRD detection disabled" };
      }

      const result = await checkNRD(domain);

      if (result.isNRD) {
        await deps.updateService(result.domain, {
          nrdResult: {
            isNRD: result.isNRD,
            confidence: result.confidence,
            domainAge: result.domainAge,
            checkedAt: result.checkedAt,
          },
        });

        await deps.addEvent({
          type: "nrd_detected",
          domain: result.domain,
          timestamp: Date.now(),
          details: {
            isNRD: result.isNRD,
            confidence: result.confidence,
            registrationDate: result.registrationDate,
            domainAge: result.domainAge,
            method: result.method,
            suspiciousScore: result.suspiciousScores.totalScore,
            isDDNS: result.ddns.isDDNS,
            ddnsProvider: result.ddns.provider,
          },
        });

        await deps.getAlertManager().alertNRD({
          domain: result.domain,
          domainAge: result.domainAge,
          registrationDate: result.registrationDate,
          confidence: result.confidence,
        });
      }

      const store = await deps.getOrInitParquetStore();
      const record = nrdResultToParquetRecord(result);
      await store.write("nrd-detections", [record]);

      return result;
    } catch (error) {
      deps.logger.error("NRD check failed:", error);
      throw error;
    }
  }

  async function setNRDConfig(newConfig: NRDConfig): Promise<{ success: boolean }> {
    try {
      await deps.setStorage({ nrdConfig: newConfig });
      await initNRDDetector();
      nrdCacheAdapter.clear();
      return { success: true };
    } catch (error) {
      deps.logger.error("Error setting NRD config:", error);
      return { success: false };
    }
  }

  async function getTyposquatConfig(): Promise<TyposquatConfig> {
    const storage = await deps.getStorage();
    return storage.typosquatConfig || DEFAULT_TYPOSQUAT_CONFIG;
  }

  async function initTyposquatDetector() {
    const config = await getTyposquatConfig();
    typosquatDetector = createTyposquatDetector(config, typosquatCacheAdapter);
  }

  async function checkTyposquat(domain: string): Promise<TyposquatResult> {
    if (!typosquatDetector) {
      await initTyposquatDetector();
    }
    return typosquatDetector.checkDomain(domain);
  }

  async function handleTyposquatCheck(domain: string): Promise<TyposquatResult | { skipped: true; reason: string }> {
    try {
      const storage = await deps.initStorage();
      const detectionConfig = storage.detectionConfig || deps.defaultDetectionConfig;

      if (!detectionConfig.enableTyposquat) {
        return { skipped: true, reason: "Typosquat detection disabled" };
      }

      const result = await checkTyposquat(domain);

      if (result.isTyposquat) {
        await deps.updateService(result.domain, {
          typosquatResult: {
            isTyposquat: result.isTyposquat,
            confidence: result.confidence,
            totalScore: result.heuristics.totalScore,
            checkedAt: result.checkedAt,
          },
        });

        await deps.addEvent({
          type: "typosquat_detected",
          domain: result.domain,
          timestamp: Date.now(),
          details: {
            isTyposquat: result.isTyposquat,
            confidence: result.confidence,
            totalScore: result.heuristics.totalScore,
            homoglyphCount: result.heuristics.homoglyphs.length,
            hasMixedScript: result.heuristics.hasMixedScript,
            detectedScripts: result.heuristics.detectedScripts,
          },
        });

        await deps.getAlertManager().alertTyposquat({
          domain: result.domain,
          homoglyphCount: result.heuristics.homoglyphs.length,
          confidence: result.confidence,
        });
      }

      const store = await deps.getOrInitParquetStore();
      const record = typosquatResultToParquetRecord(result);
      await store.write("typosquat-detections", [record]);

      return result;
    } catch (error) {
      deps.logger.error("Typosquat check failed:", error);
      throw error;
    }
  }

  async function setTyposquatConfig(newConfig: TyposquatConfig): Promise<{ success: boolean }> {
    try {
      await deps.setStorage({ typosquatConfig: newConfig });
      await initTyposquatDetector();
      typosquatCacheAdapter.clear();
      return { success: true };
    } catch (error) {
      deps.logger.error("Error setting Typosquat config:", error);
      return { success: false };
    }
  }

  return {
    getNRDConfig,
    setNRDConfig,
    handleNRDCheck,
    getTyposquatConfig,
    setTyposquatConfig,
    handleTyposquatCheck,
  };
}
