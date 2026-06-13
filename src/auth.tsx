import { useEffect, type ReactNode } from "react";
import { AuthProvider as OidcProvider, useAuth } from "react-oidc-context";
import { WebStorageStateStore } from "oidc-client-ts";
import config from "./config";
import { setAccessToken, setOnUnauthorized } from "./api/client";

const oidcConfig = {
  authority: `${config.authUrl}/realms/${config.authRealm}`,
  client_id: config.authClientId,
  // localStorage (not the sessionStorage default) so the courier tab and machine tab share one login.
  userStore: new WebStorageStateStore({ store: window.localStorage }),
  // Redirect back to the starting page: landing elsewhere strips the ?code&state before exchange (login loop).
  redirect_uri: `${window.location.origin}${window.location.pathname}`,
  onSigninCallback: () => {
    window.history.replaceState({}, "", window.location.pathname);
  },
};

export function AuthProvider({ children }: { children: ReactNode }) {
  return <OidcProvider {...oidcConfig}>{children}</OidcProvider>;
}

export function RequireAuth({ children }: { children: ReactNode }) {
  const auth = useAuth();

  useEffect(() => {
    setAccessToken(auth.user?.access_token);
  }, [auth.user?.access_token]);

  useEffect(() => {
    setOnUnauthorized(() => void auth.signinRedirect());
    return () => setOnUnauthorized(undefined);
  }, [auth]);

  useEffect(() => {
    if (!auth.isLoading && !auth.isAuthenticated && !auth.error && !auth.activeNavigator) {
      void auth.signinRedirect();
    }
  }, [auth, auth.isLoading, auth.isAuthenticated, auth.error, auth.activeNavigator]);

  useEffect(() => {
    if (!auth.error || auth.isLoading || auth.activeNavigator) return;
    const timer = setTimeout(() => void auth.signinRedirect(), 2000);
    return () => clearTimeout(timer);
  }, [auth, auth.error, auth.isLoading, auth.activeNavigator]);

  if (auth.error) {
    return (
      <Splash>
        <p className="font-semibold text-neutral-800">Sessie verlopen</p>
        <p className="mt-1 animate-pulse text-sm text-neutral-600">Je wordt opnieuw aangemeld…</p>
        <button
          className="bg-dhl-red mt-4 min-h-12 rounded-xl px-6 font-semibold text-white"
          onClick={() => void auth.signinRedirect()}
        >
          Nu opnieuw inloggen
        </button>
      </Splash>
    );
  }

  if (!auth.isAuthenticated) {
    return (
      <Splash>
        <p className="text-neutral-600">Doorsturen naar inloggen…</p>
      </Splash>
    );
  }

  return children;
}

function Splash({ children }: { children: ReactNode }) {
  return (
    <div className="bg-dhl-yellow flex min-h-dvh flex-col items-center justify-center p-6 text-center">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow">{children}</div>
    </div>
  );
}
