// OAuth helpers shared by the login UI + auth context. The backend verifies the
// id_token, so decoding here is just to extract the subject/profile for the request.

export interface OAuthProfile {
  sub: string;
  email?: string;
  name?: string;
  picture?: string;
}

// Decode a JWT id_token payload (no verification — the backend does that).
export function decodeIdToken(idToken: string): OAuthProfile | null {
  try {
    const payload = idToken.split(".")[1];
    if (!payload) return null;
    const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    const c = JSON.parse(json) as Record<string, unknown>;
    const sub = typeof c.sub === "string" ? c.sub : "";
    if (!sub) return null;
    return {
      sub,
      email: typeof c.email === "string" ? c.email : undefined,
      name: typeof c.name === "string" ? c.name : undefined,
      picture: typeof c.picture === "string" ? c.picture : undefined,
    };
  } catch {
    return null;
  }
}

// A starting handle from the email localpart; the backend enforces uniqueness.
export function deriveHandle(email?: string): string {
  const local = (email ?? "").split("@")[0] ?? "";
  const cleaned = local.toLowerCase().replace(/[^a-z0-9._-]/g, "");
  return cleaned || `user${Math.floor(Math.random() * 100000)}`;
}

// --- Apple: Sign in with Apple JS (web/desktop). Needs a Services ID. ---

const APPLE_SERVICE_ID = import.meta.env.VITE_APPLE_SERVICE_ID as string | undefined;
export const appleConfigured = Boolean(APPLE_SERVICE_ID);

interface AppleAuthResponse {
  authorization?: { id_token?: string };
}
declare global {
  interface Window {
    AppleID?: {
      auth: {
        init(config: Record<string, unknown>): void;
        signIn(): Promise<AppleAuthResponse>;
      };
    };
  }
}

let appleScript: Promise<void> | null = null;
function loadAppleScript(): Promise<void> {
  if (appleScript) return appleScript;
  appleScript = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/en_US/appleid.auth.js";
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Failed to load Apple sign-in"));
    document.head.appendChild(s);
  });
  return appleScript;
}

// Opens Apple's popup and resolves with an id_token to hand the backend.
export async function signInWithApple(): Promise<string> {
  if (!APPLE_SERVICE_ID) throw new Error("Apple sign-in is not configured");
  await loadAppleScript();
  if (!window.AppleID) throw new Error("Apple sign-in unavailable");
  window.AppleID.auth.init({
    clientId: APPLE_SERVICE_ID,
    scope: "name email",
    redirectURI: window.location.origin, // must be a registered Return URL in Apple Developer
    usePopup: true,
  });
  const res = await window.AppleID.auth.signIn();
  const idToken = res.authorization?.id_token;
  if (!idToken) throw new Error("No Apple identity token returned");
  return idToken;
}
