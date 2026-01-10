import { ViolationList } from "./ViolationList";
import { PolicyGenerator } from "./PolicyGenerator";
import type { ViolationProps } from "../types";

export function CspPanel({ violations }: ViolationProps) {
  return (
    <>
      <ViolationList violations={violations} />
      <PolicyGenerator />
    </>
  );
}
