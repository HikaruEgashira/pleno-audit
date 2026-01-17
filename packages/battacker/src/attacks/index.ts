import type { AttackTest } from "../types";
import { networkAttacks } from "./network";
import { phishingAttacks } from "./phishing";
import { clientSideAttacks } from "./client-side";
import { downloadAttacks } from "./download";

export const allAttacks: AttackTest[] = [
  ...networkAttacks,
  ...phishingAttacks,
  ...clientSideAttacks,
  ...downloadAttacks,
];

export {
  networkAttacks,
  phishingAttacks,
  clientSideAttacks,
  downloadAttacks,
};
