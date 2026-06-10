import axios from "axios";
import config from "../config";
import { TripControllerApi } from "./generated";

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
