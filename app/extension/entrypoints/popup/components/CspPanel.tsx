import type { CSPViolation } from "@service-policy-auditor/csp";
import { ViolationList } from "./ViolationList";
import { PolicyGenerator } from "./PolicyGenerator";

interface Props {
  violations: CSPViolation[];
}

export function CspPanel({ violations }: Props) {
  return (
    <>
      <ViolationList violations={violations} />
      <PolicyGenerator />
    </>
  );
}
