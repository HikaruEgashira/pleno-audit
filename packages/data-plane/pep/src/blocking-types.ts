/**
 * @fileoverview Blocking Types
 *
 * Types for the Policy Enforcement Point (PEP) blocking functionality.
 */

/**
 * Blocking configuration (user consent based, default disabled)
 */
export interface BlockingConfig {
  enabled: boolean;
  blockTyposquat: boolean;
  blockNRDLogin: boolean;
  blockHighRiskExtension: boolean;
  blockSensitiveDataToAI: boolean;
  userConsentGiven: boolean;
  consentTimestamp: number;
}

export const DEFAULT_BLOCKING_CONFIG: BlockingConfig = {
  enabled: false,
  blockTyposquat: true,
  blockNRDLogin: true,
  blockHighRiskExtension: false,
  blockSensitiveDataToAI: false,
  userConsentGiven: false,
  consentTimestamp: 0,
};
