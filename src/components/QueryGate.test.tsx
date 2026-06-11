import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { AxiosError } from "axios";
import { QueryGate } from "./QueryGate";

describe("QueryGate", () => {
  it("renders a loading state while pending", () => {
    render(
      <QueryGate isPending error={null}>
        <p>inhoud</p>
      </QueryGate>,
    );
    expect(screen.getByText("Laden…")).toBeInTheDocument();
  });

  it("renders errors through the Dutch error mapper, not raw axios English", () => {
    render(
      <QueryGate isPending={false} error={new AxiosError("Request failed with status code 401")}>
        <p>inhoud</p>
      </QueryGate>,
    );
    expect(screen.getByText("Er ging iets mis — controleer de verbinding")).toBeInTheDocument();
    expect(screen.queryByText(/Request failed/)).not.toBeInTheDocument();
  });

  it("renders the children once settled", () => {
    render(
      <QueryGate isPending={false} error={null}>
        <p>inhoud</p>
      </QueryGate>,
    );
    expect(screen.getByText("inhoud")).toBeInTheDocument();
  });
});
