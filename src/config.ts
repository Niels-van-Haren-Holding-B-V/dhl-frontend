export interface AppConfig {
  apiBaseUrl: string;
  authUrl: string;
  authRealm: string;
  authClientId: string;
  machineHostname?: string;
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
