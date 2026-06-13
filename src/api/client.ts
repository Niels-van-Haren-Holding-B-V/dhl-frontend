import axios from "axios";
import config from "../config";
import {
  DeliveryControllerApi,
  LockerSessionControllerApi,
  SimProxyControllerApi,
  TripControllerApi,
} from "./generated";

// Token pushed in from the auth layer so this client stays usable from non-React code.
let accessToken: string | undefined;

export function setAccessToken(token: string | undefined) {
  accessToken = token;
}

// 401 triggers the re-login handler once (reauthTriggered guards against a redirect storm).
let onUnauthorized: (() => void) | undefined;
let reauthTriggered = false;

export function setOnUnauthorized(handler: (() => void) | undefined) {
  onUnauthorized = handler;
  reauthTriggered = false;
}

export const http = axios.create();

http.interceptors.request.use((request) => {
  if (accessToken) {
    request.headers.Authorization = `Bearer ${accessToken}`;
  }
  return request;
});

http.interceptors.response.use(undefined, (error: unknown) => {
  if (axios.isAxiosError(error) && error.response?.status === 401 && onUnauthorized && !reauthTriggered) {
    reauthTriggered = true;
    onUnauthorized();
  }
  return Promise.reject(error instanceof Error ? error : new Error(String(error)));
});

export const tripApi = new TripControllerApi(undefined, config.apiBaseUrl, http);
export const lockerApi = new LockerSessionControllerApi(undefined, config.apiBaseUrl, http);
export const simApi = new SimProxyControllerApi(undefined, config.apiBaseUrl, http);
export const deliveryApi = new DeliveryControllerApi(undefined, config.apiBaseUrl, http);

const rejectionMessages: Record<string, string> = {
  DOOR_STILL_OPEN: "Er staat nog een deur open op de automaat — sluit die eerst.",
  DUPLICATE_BARCODE: "Deze barcode bestaat al — kies een andere.",
  NO_FITTING_SIZE: "Deze afmetingen passen in geen enkel vak.",
  NO_CAPACITY: "Geen vrij vak beschikbaar in de juiste maat.",
  NO_COMPARTMENT_AVAILABLE: "Geen vrij vak beschikbaar in de juiste maat.",
  UNKNOWN_PARCEL: "Dit pakket ligt niet in deze automaat.",
  COMPARTMENT_DEFECT: "Het vak meldt een storing.",
};

export function apiErrorCode(error: unknown): string | undefined {
  if (axios.isAxiosError(error) && error.response?.status === 422) {
    return (error.response.data as { code?: string } | undefined)?.code;
  }
  return undefined;
}

export function apiErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const body = error.response?.data as { code?: string; message?: string } | undefined;
    if (error.response?.status === 503) {
      return body?.message ?? "Pakketautomaat tijdelijk niet bereikbaar";
    }
    if (error.response?.status === 422 && body?.code) {
      return rejectionMessages[body.code] ?? body.message ?? "De automaat weigerde deze actie";
    }
    if (error.response) {
      return `Er ging iets mis (HTTP ${error.response.status})`;
    }
  }
  return "Er ging iets mis — controleer de verbinding";
}
