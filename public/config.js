// Dev defaults — matches the dhl-backend local compose stack (12xxx ports).
// In production this file is overwritten by the nginx entrypoint from env vars.
window.__APP_CONFIG__ = {
  apiBaseUrl: "http://localhost:12080",
  authUrl: "http://localhost:12081",
  authRealm: "courier",
  authClientId: "dhl-frontend",
};
