import axios from "axios";
import config from "../config";
import { LockerSessionControllerApi, SimProxyControllerApi, TripControllerApi } from "./generated";

// The auth layer pushes the current access token here (see RequireAuth); the
// client itself stays usable from non-React code.
let accessToken: string | undefined;

export function setAccessToken(token: string | undefined) {
  accessToken = token;
}

export const http = axios.create();

http.interceptors.request.use((request) => {
  if (accessToken) {
    request.headers.Authorization = `Bearer ${accessToken}`;
  }
  return request;
});

export const tripApi = new TripControllerApi(undefined, config.apiBaseUrl, http);
export const lockerApi = new LockerSessionControllerApi(undefined, config.apiBaseUrl, http);
export const simApi = new SimProxyControllerApi(undefined, config.apiBaseUrl, http);

/** Dutch-friendly message for failed calls; 503 = open circuit breaker. */
export function apiErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    if (error.response?.status === 503) {
      const body = error.response.data as { message?: string } | undefined;
      return body?.message ?? "Pakketautomaat tijdelijk niet bereikbaar";
    }
    if (error.response) {
      return `Er ging iets mis (HTTP ${error.response.status})`;
    }
  }
  return "Er ging iets mis — controleer de verbinding";
}
