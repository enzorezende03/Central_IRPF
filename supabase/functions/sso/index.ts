import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const b64urlToBytes = (s: string): Uint8Array => {
  const pad = "=".repeat((4 - (s.length % 4)) % 4);
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + pad;
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
};

const bytesToB64url = (bytes: Uint8Array): string => {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

const timingSafeEqual = (a: Uint8Array, b: Uint8Array): boolean => {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
};

async function hmacSha256(secret: string, message: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return new Uint8Array(sig);
}

const text = (body: string, status: number) =>
  new Response(body, { status, headers: { "Content-Type": "text/plain; charset=utf-8" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      },
    });
  }

  try {
    const url = new URL(req.url);
    const token = url.searchParams.get("token");
    const redirect = url.searchParams.get("redirect") || "/";

    if (!token) return text("Token ausente.", 400);

    const secret = Deno.env.get("SSO_SHARED_SECRET");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!secret) return text("SSO_SHARED_SECRET não configurado.", 500);
    if (!supabaseUrl || !serviceRoleKey) return text("Credenciais do servidor ausentes.", 500);

    const parts = token.split(".");
    if (parts.length !== 2) return text("Token mal formado.", 400);
    const [payloadB64, signatureB64] = parts;

    let providedSig: Uint8Array;
    try {
      providedSig = b64urlToBytes(signatureB64);
    } catch {
      return text("Assinatura inválida.", 400);
    }

    const expectedSig = await hmacSha256(secret, payloadB64);
    if (!timingSafeEqual(providedSig, expectedSig)) {
      return text("Assinatura inválida.", 401);
    }

    let payload: { email?: string; name?: string; cnpj?: string; iat?: number; exp?: number };
    try {
      payload = JSON.parse(new TextDecoder().decode(b64urlToBytes(payloadB64)));
    } catch {
      return text("Payload inválido.", 400);
    }

    const now = Math.floor(Date.now() / 1000);
    if (!payload.exp || payload.exp <= now) return text("Token expirado.", 401);
    if (!payload.email) return text("Email ausente no token.", 400);

    const email = payload.email.toLowerCase().trim();
    const name = payload.name?.trim() || "";
    const cnpj = payload.cnpj?.trim() || "";

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Find user by email
    let existingUser: any = null;
    let page = 1;
    while (true) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
      if (error) return text("Erro ao buscar usuário: " + error.message, 500);
      existingUser = data.users.find((u) => u.email?.toLowerCase() === email) ?? null;
      if (existingUser || data.users.length < 1000) break;
      page++;
      if (page > 50) break;
    }

    if (!existingUser) {
      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email,
        email_confirm: true,
        user_metadata: { nome: name, cnpj },
      });
      if (createErr) return text("Erro ao criar usuário: " + createErr.message, 500);
      existingUser = created.user;
    } else if (name || cnpj) {
      const meta = { ...(existingUser.user_metadata || {}) };
      if (name) meta.nome = name;
      if (cnpj) meta.cnpj = cnpj;
      await admin.auth.admin.updateUserById(existingUser.id, { user_metadata: meta });
    }

    const origin = url.origin.includes("supabase.co")
      ? (req.headers.get("origin") || "https://central-irpf.lovable.app")
      : url.origin;

    const safeRedirect = redirect.startsWith("/") ? redirect : "/";
    const redirectTo = "https://central-irpf.lovable.app" + safeRedirect;

    const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email,
      options: { redirectTo },
    });
    if (linkErr) return text("Erro ao gerar link: " + linkErr.message, 500);

    const actionLink = (linkData as any)?.properties?.action_link;
    if (!actionLink) return text("Falha ao gerar action link.", 500);

    return new Response(null, { status: 302, headers: { Location: actionLink } });
  } catch (e: any) {
    return text("Erro interno: " + (e?.message ?? String(e)), 500);
  }
});
