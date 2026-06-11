import { describe, expect, it } from "vitest";
import { AxiosError, type AxiosResponse, type InternalAxiosRequestConfig } from "axios";
import { apiErrorCode, apiErrorMessage } from "./client";

function httpError(status: number, data?: unknown): AxiosError {
  const error = new AxiosError(`Request failed with status code ${status}`);
  error.response = {
    status,
    data,
    statusText: "",
    headers: {},
    config: {} as InternalAxiosRequestConfig,
  } as AxiosResponse;
  return error;
}

describe("apiErrorMessage", () => {
  it("maps a bare 503 to the circuit-breaker message", () => {
    expect(apiErrorMessage(httpError(503))).toBe("Pakketautomaat tijdelijk niet bereikbaar");
  });

  it("prefers the backend message on a 503", () => {
    expect(apiErrorMessage(httpError(503, { message: "Automaat offline tot 12:00" }))).toBe(
      "Automaat offline tot 12:00",
    );
  });

  it.each([
    ["DOOR_STILL_OPEN", "Er staat nog een deur open op de automaat — sluit die eerst."],
    ["NO_COMPARTMENT_AVAILABLE", "Geen vrij vak beschikbaar in de juiste maat."],
    ["UNKNOWN_PARCEL", "Dit pakket ligt niet in deze automaat."],
    ["COMPARTMENT_DEFECT", "Het vak meldt een storing."],
  ])("maps the 422 rejection code %s to actionable Dutch", (code, expected) => {
    expect(apiErrorMessage(httpError(422, { code }))).toBe(expected);
  });

  it("falls back to the backend message for an unknown 422 code", () => {
    expect(apiErrorMessage(httpError(422, { code: "SOMETHING_NEW", message: "Nieuwe fout" }))).toBe(
      "Nieuwe fout",
    );
  });

  it("falls back to a generic refusal for an unknown 422 code without message", () => {
    expect(apiErrorMessage(httpError(422, { code: "SOMETHING_NEW" }))).toBe(
      "De automaat weigerde deze actie",
    );
  });

  it("names the status for other HTTP errors", () => {
    expect(apiErrorMessage(httpError(500))).toBe("Er ging iets mis (HTTP 500)");
  });

  it("treats a response-less axios error as a connection problem", () => {
    expect(apiErrorMessage(new AxiosError("Network Error"))).toBe(
      "Er ging iets mis — controleer de verbinding",
    );
  });

  it("treats a non-axios error as a connection problem", () => {
    expect(apiErrorMessage(new Error("boom"))).toBe("Er ging iets mis — controleer de verbinding");
  });
});

describe("apiErrorCode", () => {
  it("returns the rejection code of a 422", () => {
    expect(apiErrorCode(httpError(422, { code: "NO_COMPARTMENT_AVAILABLE" }))).toBe(
      "NO_COMPARTMENT_AVAILABLE",
    );
  });

  it("returns undefined for non-422 responses", () => {
    expect(apiErrorCode(httpError(503, { code: "IGNORED" }))).toBeUndefined();
  });

  it("returns undefined for non-axios errors", () => {
    expect(apiErrorCode(new Error("boom"))).toBeUndefined();
  });
});
