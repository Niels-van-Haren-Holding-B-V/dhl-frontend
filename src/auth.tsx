import { useEffect, type ReactNode } from "react";
import { AuthProvider as OidcProvider, useAuth } from "react-oidc-context";
import config from "./config";
import { setAccessToken } from "./api/client";

const oidcConfig = {
  authority: `${config.authUrl}/realms/${config.authRealm}`,
  client_id: config.authClientId,
  redirect_uri: `${window.location.origin}/`,
  // Strip the ?code=&state= params Keycloak appends after the redirect.
  onSigninCallback: () => {
    window.history.replaceState({}, "", window.location.pathname);
  },
};

export function AuthProvider({ children }: { children: ReactNode }) {
  return <OidcProvider {...oidcConfig}>{children}</OidcProvider>;
}

/** Blocks rendering until there is a logged-in courier; otherwise redirects to Keycloak. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const auth = useAuth();

  useEffect(() => {
    setAccessToken(auth.user?.access_token);
  }, [auth.user?.access_token]);

  useEffect(() => {
    if (!auth.isLoading && !auth.isAuthenticated && !auth.error) {
      void auth.signinRedirect();
    }
  }, [auth, auth.isLoading, auth.isAuthenticated, auth.error]);

  if (auth.error) {
    return (
      <Splash>
        <p className="text-dhl-red font-semibold">Inloggen mislukt</p>
        <p className="mt-1 text-sm text-neutral-600">{auth.error.message}</p>
        <button
          className="mt-4 min-h-12 rounded-xl bg-dhl-red px-6 font-semibold text-white"
          onClick={() => void auth.signinRedirect()}
        >
          Opnieuw proberen
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
    <div className="flex min-h-dvh flex-col items-center justify-center bg-dhl-yellow p-6 text-center">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow">{children}</div>
    </div>
  );
}
