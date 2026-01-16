import type { AttackTest } from "../types";
import { networkAttacks } from "./network";
import { phishingAttacks } from "./phishing";
import { clientSideAttacks } from "./client-side";
import { extensionAttacks } from "./extension";
import { downloadAttacks } from "./download";

export const allAttacks: AttackTest[] = [
  ...networkAttacks,
  ...phishingAttacks,
  ...clientSideAttacks,
  ...extensionAttacks,
  ...downloadAttacks,
];

export {
  networkAttacks,
  phishingAttacks,
  clientSideAttacks,
  extensionAttacks,
  downloadAttacks,
};
