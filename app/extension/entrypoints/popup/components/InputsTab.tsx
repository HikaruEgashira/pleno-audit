import { InputList } from "./InputList";
import type { CapturedInput } from "@pleno-audit/detectors";

interface Props {
  inputs: CapturedInput[];
}

export function InputsTab({ inputs }: Props) {
  return (
    <div>
      <InputList inputs={inputs} />
    </div>
  );
}
