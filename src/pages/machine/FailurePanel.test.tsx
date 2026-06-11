import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { FailurePanel } from "./FailurePanel";
import type { SimStateSnapshot } from "../../api/generated";

const q = vi.hoisted(() => ({
  toggle: { mutate: vi.fn(), isPending: false },
}));

vi.mock("../../queries/simState", () => ({
  useFailureToggle: () => q.toggle,
}));

function machineState(activeFailures: SimStateSnapshot["activeFailures"] = []): SimStateSnapshot {
  return { config: "BIG", session: null, compartments: [], activeFailures, eventLog: [] };
}

describe("FailurePanel", () => {
  beforeEach(() => {
    q.toggle.mutate.mockClear();
  });

  it("renders all six failure toggles, off by default", () => {
    render(<FailurePanel state={machineState()} />);
    for (const label of [
      "Vak te klein",
      "Deur klemt",
      "Vak defect",
      "Pakket ontbreekt",
      "Traag netwerk",
      "Forceer 409",
    ]) {
      expect(screen.getByRole("button", { name: new RegExp(label) })).toBeInTheDocument();
    }
    expect(screen.getAllByText("uit")).toHaveLength(6);
    expect(screen.queryByText("AAN")).not.toBeInTheDocument();
  });

  it("arms an inactive failure", () => {
    render(<FailurePanel state={machineState()} />);
    fireEvent.click(screen.getByRole("button", { name: /Vak te klein/ }));
    expect(q.toggle.mutate).toHaveBeenCalledWith({ mode: "SIZE_TOO_SMALL", enabled: true });
  });

  it("shows an active failure as AAN and disarms it on click", () => {
    render(<FailurePanel state={machineState(["FORCE_409"])} />);
    const button = screen.getByRole("button", { name: /Forceer 409/ });
    expect(button).toHaveTextContent("AAN");
    fireEvent.click(button);
    expect(q.toggle.mutate).toHaveBeenCalledWith({ mode: "FORCE_409", enabled: false });
  });
});
