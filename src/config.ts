// Runtime config injected via /config.js (window.__APP_CONFIG__) so one image
// serves every environment — see public/config.js for the dev defaults.
export interface AppConfig {
  apiBaseUrl: string;
  authUrl: string;
  authRealm: string;
  authClientId: string;
}

declare global {
  interface Window {
    __APP_CONFIG__?: AppConfig;
  }
}

function loadConfig(): AppConfig {
  if (!window.__APP_CONFIG__) {
    throw new Error("Runtime config ontbreekt: /config.js is niet geladen");
  }
  return window.__APP_CONFIG__;
}

const config = loadConfig();

export default config;
