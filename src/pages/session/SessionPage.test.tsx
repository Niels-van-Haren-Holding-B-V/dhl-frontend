import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { AxiosError } from "axios";
import { SessionPage } from "./SessionPage";
import type { SessionStatusDto, ValidationResultDto } from "../../api/generated";
import type { ParcelView, TripView } from "../../api/types";

// The wizard renders purely from the polled server state, so the whole page is
// testable by stubbing the query hooks and flipping simState per test — no
// network, no QueryClient. The mocks live in one mutable bag (hoisted above
// the vi.mock factories) that beforeEach resets.
const q = vi.hoisted(() => {
  const makeMutation = () => ({
    mutate: vi.fn(),
    reset: vi.fn(),
    isPending: false,
    error: null as Error | null,
    data: undefined as unknown,
  });
  return {
    session: {
      data: undefined as SessionStatusDto | undefined,
      isPending: false,
      error: null as Error | null,
      dataUpdatedAt: 1,
    },
    trips: { data: undefined as TripView[] | undefined },
    action: makeMutation(),
    validate: makeMutation(),
    register: makeMutation(),
  };
});

vi.mock("../../queries/lockerSession", () => ({
  useLockerSession: () => q.session,
  useSessionAction: () => q.action,
  useValidate: () => q.validate,
  useRegisterNotDelivered: () => q.register,
}));
vi.mock("../../queries/trips", () => ({
  useTrips: () => q.trips,
}));

const dimensions = { lengthCm: 20, widthCm: 15, heightCm: 10, weightG: 1200 };
const parcelIn: ParcelView = {
  id: "p1",
  barcode: "DHL-IN-001",
  direction: "HAND_IN",
  status: "EXPECTED",
  size: "S",
  dimensions,
};
const parcelIn2: ParcelView = {
  id: "p2",
  barcode: "DHL-IN-002",
  direction: "HAND_IN",
  status: "EXPECTED",
  size: "L",
  dimensions,
};
const parcelOut: ParcelView = {
  id: "p3",
  barcode: "DHL-OUT-001",
  direction: "HAND_OUT",
  status: "EXPECTED",
  size: "M",
  dimensions,
};

function makeTrips(parcels: ParcelView[]): TripView[] {
  return [
    {
      id: "t1",
      name: "Rit 1",
      tripDate: "2026-06-11",
      stops: [{ id: "s1", seq: 1, address: "Teststraat 1", deliveryLocationType: "LOCKER", parcels }],
    },
  ];
}

function setSimState(
  simState: SessionStatusDto["simState"],
  sessionStatus: SessionStatusDto["sessionStatus"] = "ACTIVE",
) {
  q.session.data = { sessionId: "sess1", simState, sessionStatus, version: 1 };
}

function sessionUi(state?: { qrPayload?: string; barcode?: string }) {
  return (
    <MemoryRouter initialEntries={[{ pathname: "/trips/t1/stops/s1/session/sess1", state: state ?? null }]}>
      <Routes>
        <Route path="/trips/:tripId/stops/:stopId/session/:sessionId" element={<SessionPage />} />
      </Routes>
    </MemoryRouter>
  );
}

/** Make the stubbed validate call answer synchronously with the given verdict. */
function answerValidate(result: ValidationResultDto) {
  q.validate.mutate.mockImplementation(
    (_barcode: unknown, opts?: { onSuccess?: (result: ValidationResultDto) => void }) =>
      opts?.onSuccess?.(result),
  );
}

beforeEach(() => {
  q.session.data = undefined;
  q.session.isPending = false;
  q.session.error = null;
  q.session.dataUpdatedAt = 1;
  q.trips.data = makeTrips([parcelIn, parcelIn2, parcelOut]);
  for (const m of [q.action, q.validate, q.register]) {
    m.mutate = vi.fn();
    m.reset = vi.fn();
    m.isPending = false;
    m.error = null;
    m.data = undefined;
  }
});

describe("route guard", () => {
  it("renders a dead-link message when route params are missing", () => {
    render(
      <MemoryRouter initialEntries={["/broken"]}>
        <Routes>
          <Route path="/broken" element={<SessionPage />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByText("Sessie niet gevonden")).toBeInTheDocument();
  });
});

describe("session-level states", () => {
  it("shows the expired screen when the session is EXPIRED", () => {
    setSimState("READY", "EXPIRED");
    render(sessionUi());
    expect(screen.getByText("Sessie verlopen")).toBeInTheDocument();
    expect(screen.getByText(/standaard niet-bezorgd afhandeling/)).toBeInTheDocument();
  });

  it("shows the finished screen on FINISHED", () => {
    setSimState("FINISHED");
    render(sessionUi());
    expect(screen.getByText("Sessie afgerond")).toBeInTheDocument();
  });

  it("falls back to a busy screen on an unknown state", () => {
    q.session.data = { sessionId: "sess1", sessionStatus: "ACTIVE", version: 1 };
    render(sessionUi());
    expect(screen.getByText("Bezig…")).toBeInTheDocument();
    expect(screen.getByText("Status: onbekend")).toBeInTheDocument();
  });
});

describe("CREATED — QR step", () => {
  it("shows the QR and waits for the machine to bind", () => {
    setSimState("CREATED");
    render(sessionUi({ qrPayload: "QR-PAYLOAD", barcode: "DHL-IN-001" }));
    expect(screen.getByText("Scan de QR-code op de pakketautomaat")).toBeInTheDocument();
    expect(screen.getByText("Wachten op koppeling…")).toBeInTheDocument();
    expect(screen.getByText("DHL-IN-001")).toBeInTheDocument();
  });

  it("offers finishing the session when the QR payload is gone after a reload", () => {
    setSimState("CREATED");
    render(sessionUi());
    expect(screen.getByText(/niet meer beschikbaar/)).toBeInTheDocument();
    fireEvent.click(screen.getByText("Sessie afronden"));
    expect(q.action.mutate).toHaveBeenCalledWith({ action: "finish" });
  });
});

describe("READY — one-tap auto-fire", () => {
  it("fires validate + attempt for a picked hand-in parcel, exactly once", () => {
    answerValidate({ valid: true });
    setSimState("READY");
    const view = render(sessionUi({ barcode: "DHL-IN-001" }));
    expect(q.validate.mutate).toHaveBeenCalledTimes(1);
    expect(q.validate.mutate.mock.calls[0][0]).toBe("DHL-IN-001");
    expect(q.action.mutate).toHaveBeenCalledWith({ action: "attempt", barcode: "DHL-IN-001" });

    // more polls of the same state must NOT re-fire the attempt
    q.session.dataUpdatedAt = 2;
    view.rerender(sessionUi({ barcode: "DHL-IN-001" }));
    q.session.dataUpdatedAt = 3;
    view.rerender(sessionUi({ barcode: "DHL-IN-001" }));
    expect(q.validate.mutate).toHaveBeenCalledTimes(1);
  });

  it("fires hand-out/start (no validate) for a hand-out parcel", () => {
    setSimState("READY");
    render(sessionUi({ barcode: "DHL-OUT-001" }));
    expect(q.validate.mutate).not.toHaveBeenCalled();
    expect(q.action.mutate).toHaveBeenCalledWith({ action: "out-start", barcode: "DHL-OUT-001" });
  });

  it("lists open parcels and auto-fires after tapping one", () => {
    answerValidate({ valid: true });
    setSimState("READY");
    render(sessionUi());
    expect(screen.getByText("Kies een pakket")).toBeInTheDocument();
    fireEvent.click(screen.getByText("DHL-IN-002"));
    expect(q.validate.mutate.mock.calls[0][0]).toBe("DHL-IN-002");
    expect(q.action.mutate).toHaveBeenCalledWith({ action: "attempt", barcode: "DHL-IN-002" });
  });

  it("sends an unknown manually entered barcode to the backend for validation", () => {
    setSimState("READY");
    render(sessionUi());
    fireEvent.click(screen.getByText("Barcode handmatig invoeren"));
    fireEvent.change(screen.getByPlaceholderText("DHL-…"), { target: { value: "DHL-XX-999" } });
    fireEvent.click(screen.getByText("Scan"));
    expect(q.validate.mutate.mock.calls[0][0]).toBe("DHL-XX-999");
  });
});

describe("READY — escalation", () => {
  it("shows the size proposal when validation rejects with a suggested size", () => {
    answerValidate({ valid: false, suggestedSize: "M" });
    setSimState("READY");
    render(sessionUi({ barcode: "DHL-IN-001" }));
    expect(screen.getByText(/Vak te klein — nieuw voorstel: M/)).toBeInTheDocument();
    expect(q.action.mutate).not.toHaveBeenCalled();

    // retry re-arms the wizard: verdict cleared, mutations reset
    fireEvent.click(screen.getByText("Opnieuw proberen"));
    expect(q.action.reset).toHaveBeenCalled();
    expect(q.validate.reset).toHaveBeenCalled();
    expect(screen.queryByText(/nieuw voorstel/)).not.toBeInTheDocument();
  });

  it("dead-ends on NO_CAPACITY and registers the parcel as not delivered", () => {
    answerValidate({ valid: false, reason: "NO_CAPACITY" });
    setSimState("READY");
    render(sessionUi({ barcode: "DHL-IN-001" }));
    expect(screen.getByText(/kan niet in deze automaat bezorgd worden/)).toBeInTheDocument();
    fireEvent.click(screen.getByText("Registreer als niet bezorgd"));
    expect(q.register.mutate.mock.calls[0][0]).toBe("DHL-IN-001");
  });

  it("dead-ends when the attempt is rejected with NO_COMPARTMENT_AVAILABLE", () => {
    const error = new AxiosError("Unprocessable");
    error.response = {
      status: 422,
      data: { code: "NO_COMPARTMENT_AVAILABLE" },
      statusText: "",
      headers: {},
      config: {},
    } as never;
    q.action.error = error;
    setSimState("READY");
    render(sessionUi({ barcode: "DHL-IN-001" }));
    expect(screen.getByText(/kan niet in deze automaat bezorgd worden/)).toBeInTheDocument();
  });
});

describe("HAND_IN door open", () => {
  it("shows the compartment and instructions", () => {
    setSimState("HAND_IN_DOOR_OPEN");
    q.action.data = { compartment: { label: "A3" } };
    render(sessionUi({ barcode: "DHL-IN-001" }));
    expect(screen.getByText("Plaats pakket en sluit de deur")).toBeInTheDocument();
    expect(screen.getByText("Vak A3")).toBeInTheDocument();
    expect(screen.getByText("DHL-IN-001")).toBeInTheDocument();
  });

  it("escalates 'Vak te klein' so the next bigger door can open", () => {
    setSimState("HAND_IN_DOOR_OPEN");
    render(sessionUi({ barcode: "DHL-IN-001" }));
    fireEvent.click(screen.getByText("Vak te klein"));
    expect(q.action.mutate.mock.calls[0][0]).toEqual({ action: "report-size" });
  });

  it("offers door-stuck escape hatches only after the threshold of polls", () => {
    setSimState("HAND_IN_DOOR_OPEN");
    const view = render(sessionUi({ barcode: "DHL-IN-001" }));
    expect(screen.queryByText("Deur niet gesloten?")).not.toBeInTheDocument();

    for (let poll = 2; poll <= 9; poll++) {
      q.session.dataUpdatedAt = poll;
      view.rerender(sessionUi({ barcode: "DHL-IN-001" }));
    }
    expect(screen.getByText("Deur niet gesloten?")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Open vak opnieuw"));
    expect(q.action.mutate.mock.calls[0][0]).toEqual({ action: "reopen" });
    fireEvent.click(screen.getByText("Meld defect vak"));
    expect(q.action.mutate.mock.calls[1][0]).toEqual({ action: "report-issue" });
  });
});

describe("confirm steps", () => {
  it("confirms a hand-in", () => {
    setSimState("HAND_IN_AWAITING_CONFIRM");
    render(sessionUi({ barcode: "DHL-IN-001" }));
    expect(screen.getByText("Deur gesloten")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Bevestig plaatsing"));
    expect(q.action.mutate).toHaveBeenCalledWith({ action: "confirm", barcode: "DHL-IN-001" });
  });

  it("confirms a hand-out", () => {
    setSimState("HAND_OUT_AWAITING_CONFIRM");
    render(sessionUi({ barcode: "DHL-OUT-001" }));
    fireEvent.click(screen.getByText("Bevestig ophalen"));
    expect(q.action.mutate).toHaveBeenCalledWith({ action: "out-confirm", barcode: "DHL-OUT-001" });
  });

  it("recovers onto the right step from server state alone (killed tab)", () => {
    // no router state at all: the page is opened fresh mid-flow
    setSimState("HAND_IN_AWAITING_CONFIRM");
    render(sessionUi());
    expect(screen.getByText("Deur gesloten")).toBeInTheDocument();
    expect(screen.getByText("Bevestig plaatsing")).toBeInTheDocument();
  });
});

describe("HAND_OUT door open", () => {
  it("offers report-missing and abort", () => {
    setSimState("HAND_OUT_DOOR_OPEN");
    render(sessionUi({ barcode: "DHL-OUT-001" }));
    expect(screen.getByText("Neem het pakket uit het vak")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Pakket ontbreekt"));
    expect(q.action.mutate).toHaveBeenCalledWith(
      { action: "report-missing", barcode: "DHL-OUT-001" },
      expect.anything(), // onSuccess resets the flow back to the picker
    );
    fireEvent.click(screen.getByText("Afbreken"));
    expect(q.action.mutate).toHaveBeenCalledWith({ action: "abort" });
  });
});

describe("completed", () => {
  it("offers the next open parcel after a hand-in", () => {
    setSimState("HAND_IN_COMPLETED");
    render(sessionUi({ barcode: "DHL-IN-001" }));
    expect(screen.getByText("Pakket ingeleverd ✓")).toBeInTheDocument();
    expect(screen.getByText(/Volgende voor deze stop \(2 te gaan\)/)).toBeInTheDocument();
    fireEvent.click(screen.getByText(/Volgende inleveren/));
    expect(q.action.mutate).toHaveBeenCalledWith({ action: "continue" });
  });

  it("reports the stop as done when nothing is left", () => {
    q.trips.data = makeTrips([
      { ...parcelIn, status: "HANDED_IN" },
      { ...parcelOut, status: "HANDED_OUT" },
    ]);
    setSimState("HAND_OUT_COMPLETED");
    render(sessionUi());
    expect(screen.getByText("Pakket opgehaald ✓")).toBeInTheDocument();
    expect(screen.getByText("Alle pakketten voor deze stop zijn afgehandeld.")).toBeInTheDocument();
  });
});

describe("footers", () => {
  it("shows the reconcile banner when an action reports reconciled", () => {
    setSimState("READY");
    q.action.data = { reconciled: true };
    render(sessionUi());
    expect(screen.getByText(/bijgewerkt na een conflict/)).toBeInTheDocument();
  });

  it("offers a retry when a reconciled action leaves the wizard parked on READY", () => {
    // FORCE_409 scenario: the attempt was rejected, the BFF reconciled back
    // to READY (success response, no error) — without a retry the one-tap
    // flow dead-ends because the auto-fire guard has burnt for this barcode.
    setSimState("READY");
    q.action.data = { reconciled: true };
    render(sessionUi({ barcode: "DHL-IN-001" }));
    expect(screen.getByText(/bijgewerkt na een conflict/)).toBeInTheDocument();
    fireEvent.click(screen.getByText("Opnieuw proberen"));
    // rearm: clears the mutation result and the auto-fire guard so the
    // next READY poll fires validate+attempt again
    expect(q.action.reset).toHaveBeenCalled();
    expect(q.validate.reset).toHaveBeenCalled();
  });

  it("shows a Dutch error message for a failed action", () => {
    setSimState("READY");
    q.action.error = new Error("boom");
    render(sessionUi());
    expect(screen.getByText("Er ging iets mis — controleer de verbinding")).toBeInTheDocument();
  });
});
