import { supabase } from "@/integrations/supabase/client";

export async function consumeSsoToken(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  const m = window.location.hash.match(/#sso=([^&]+)/);
  if (!m) return false;
  try {
    const b64 = m[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
    const { access_token, refresh_token } = JSON.parse(atob(padded));
    await supabase.auth.setSession({ access_token, refresh_token });
    history.replaceState(null, "", window.location.pathname + window.location.search);
    return true;
  } catch (e) {
    console.error("SSO falhou", e);
    return false;
  }
}
