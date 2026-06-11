import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ConsoleSlot } from "./ConsoleSlot";
import type { SimStateSnapshot } from "../../api/generated";

const q = vi.hoisted(() => ({
  bind: {
    mutate: vi.fn(),
    isPending: false,
    error: null as Error | null,
  },
}));

vi.mock("../../queries/simState", () => ({
  useBind: () => q.bind,
}));
// jsdom has neither getUserMedia nor AudioContext
vi.mock("../../components/QrCameraScanner", () => ({
  QrCameraScanner: () => <div data-testid="camera" />,
}));
vi.mock("../../components/scannerBeep", () => ({ scannerBeep: vi.fn() }));

function machineState(session: SimStateSnapshot["session"] = null): SimStateSnapshot {
  return { config: "BIG", session, compartments: [], activeFailures: [], eventLog: [] };
}

describe("ConsoleSlot bind flow", () => {
  beforeEach(() => {
    q.bind.mutate.mockClear();
    q.bind.error = null;
  });

  it("offers the camera first with a manual fallback", () => {
    render(<ConsoleSlot state={machineState()} />);
    expect(screen.getByTestId("camera")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Handmatig invoeren"));
    expect(screen.getByLabelText("Scan QR-code van de koerier")).toBeInTheDocument();
  });

  it("binds a manually entered QR payload and shows the splash on success", () => {
    q.bind.mutate.mockImplementation((_code: string, opts?: { onSuccess?: () => void }) =>
      opts?.onSuccess?.(),
    );
    render(<ConsoleSlot state={machineState()} />);
    fireEvent.click(screen.getByText("Handmatig invoeren"));
    fireEvent.change(screen.getByLabelText("Scan QR-code van de koerier"), {
      target: { value: "DHL-LOCKER:abc" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Scan QR" }));
    expect(q.bind.mutate).toHaveBeenCalledWith("DHL-LOCKER:abc", expect.anything());
    expect(screen.getByText("Gekoppeld ✓")).toBeInTheDocument();
  });

  it("shows the active session instead of the scanner once bound", () => {
    render(<ConsoleSlot state={machineState({ id: "s1", state: "READY", version: 1, boundAt: null })} />);
    expect(screen.getByText("Sessie actief")).toBeInTheDocument();
    expect(screen.queryByTestId("camera")).not.toBeInTheDocument();
  });
});
