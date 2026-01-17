import type { AttackTest } from "../types";
import { networkAttacks } from "./network";
import { phishingAttacks } from "./phishing";
import { clientSideAttacks } from "./client-side";
import { downloadAttacks } from "./download";
import { persistenceAttacks } from "./persistence";
import { sideChannelAttacks } from "./side-channel";
import { fingerprintingAttacks } from "./fingerprinting";
import { cryptojackingAttacks } from "./cryptojacking";
import { privacyAttacks } from "./privacy";
import { mediaAttacks } from "./media";
import { storageAttacks } from "./storage";
import { workerAttacks } from "./worker";
import { injectionAttacks } from "./injection";
import { covertAttacks } from "./covert";
import { advancedAttacks } from "./advanced";
import { finalAttacks } from "./final";
import { deepestAttacks } from "./deepest";
import { hybridAttacks } from "./hybrid";

export const allAttacks: AttackTest[] = [
  ...networkAttacks,
  ...phishingAttacks,
  ...clientSideAttacks,
  ...downloadAttacks,
  ...persistenceAttacks,
  ...sideChannelAttacks,
  ...fingerprintingAttacks,
  ...cryptojackingAttacks,
  ...privacyAttacks,
  ...mediaAttacks,
  ...storageAttacks,
  ...workerAttacks,
  ...injectionAttacks,
  ...covertAttacks,
  ...advancedAttacks,
  ...finalAttacks,
  ...deepestAttacks,
  ...hybridAttacks,
];

export {
  networkAttacks,
  phishingAttacks,
  clientSideAttacks,
  downloadAttacks,
  persistenceAttacks,
  sideChannelAttacks,
  fingerprintingAttacks,
  cryptojackingAttacks,
  privacyAttacks,
  mediaAttacks,
  storageAttacks,
  workerAttacks,
  injectionAttacks,
  covertAttacks,
  advancedAttacks,
  finalAttacks,
  deepestAttacks,
  hybridAttacks,
};
