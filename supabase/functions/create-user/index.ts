import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: any, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

async function verifyAdmin(req: Request) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) throw { status: 401, message: "Não autorizado." };

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = req.headers.get("apikey") ?? Deno.env.get("SUPABASE_ANON_KEY") ?? "";

  const callerClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user: caller } } = await callerClient.auth.getUser();
  if (!caller) throw { status: 401, message: "Não autorizado." };

  const adminClient = createClient(supabaseUrl, serviceRoleKey);
  const { data: roleData } = await adminClient
    .from("user_roles")
    .select("role")
    .eq("user_id", caller.id)
    .eq("role", "admin")
    .maybeSingle();

  if (!roleData) throw { status: 403, message: "Apenas administradores podem gerenciar usuários." };

  return { adminClient, callerId: caller.id };
}

async function setUserRoleAndProfile(adminClient: any, userId: string, role: string, accessProfileId: string | null) {
  await adminClient.from("user_roles").delete().eq("user_id", userId);
  await adminClient.from("user_roles").insert({
    user_id: userId,
    role,
    access_profile_id: role === "admin" ? null : accessProfileId,
  });
  // Trigger sync_user_role_profile_permissions handles user_permissions automatically.
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { adminClient, callerId } = await verifyAdmin(req);
    const body = await req.json();
    const action = body.action ?? "create";

    // CREATE
    if (action === "create") {
      const { email, password, full_name, role, access_profile_id } = body;
      if (!email || !password) return json({ error: "E-mail e senha são obrigatórios." }, 400);

      const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: full_name || "" },
      });
      if (createError) return json({ error: createError.message }, 400);

      if (newUser.user && role) {
        await setUserRoleAndProfile(adminClient, newUser.user.id, role, access_profile_id ?? null);
      }

      return json({ success: true, user_id: newUser.user?.id });
    }

    // UPDATE
    if (action === "update") {
      const { user_id, full_name, role, access_profile_id } = body;
      if (!user_id) return json({ error: "user_id é obrigatório." }, 400);

      if (full_name !== undefined) {
        await adminClient.auth.admin.updateUserById(user_id, {
          user_metadata: { full_name },
        });
        await adminClient.from("profiles").update({ full_name }).eq("id", user_id);
      }

      if (role) {
        await setUserRoleAndProfile(adminClient, user_id, role, access_profile_id ?? null);
      }

      return json({ success: true });
    }

    // RESET PASSWORD
    if (action === "reset_password") {
      const { email } = body;
      if (!email) return json({ error: "E-mail é obrigatório." }, 400);

      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
      const anonClient = createClient(supabaseUrl, anonKey);

      const { error } = await anonClient.auth.resetPasswordForEmail(email, {
        redirectTo: `${req.headers.get("origin") || supabaseUrl}/reset-password`,
      });
      if (error) return json({ error: error.message }, 400);

      return json({ success: true });
    }

    // DELETE
    if (action === "delete") {
      const { user_id } = body;
      if (!user_id) return json({ error: "user_id é obrigatório." }, 400);
      if (user_id === callerId) return json({ error: "Você não pode excluir a si mesmo." }, 400);

      const { error } = await adminClient.auth.admin.deleteUser(user_id);
      if (error) return json({ error: error.message }, 400);

      return json({ success: true });
    }

    return json({ error: "Ação inválida." }, 400);
  } catch (err: any) {
    return json({ error: err.message ?? "Erro interno." }, err.status ?? 500);
  }
});
