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
};
