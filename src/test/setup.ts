import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

// config.ts reads window.__APP_CONFIG__ at import time (normally injected via
// /config.js); provide it before any test imports application modules.
window.__APP_CONFIG__ = {
  apiBaseUrl: "http://api.test",
  authUrl: "http://auth.test",
  authRealm: "courier",
  authClientId: "dhl-frontend",
};

afterEach(cleanup);
