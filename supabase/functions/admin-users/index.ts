import {
  admin,
  body,
  json,
  limit,
  preflight,
  requireAdmin,
} from "../_shared/http.ts";
Deno.serve(async (req) => {
  const early = preflight(req);
  if (early) return early;
  try {
    const actor = await requireAdmin(req);
    await limit(req, "admin-users", 30);
    const input = await body(req), db = admin();
    if (input.action === "create") {
      const role = input.role === "Admin"
        ? "admin"
        : input.role === "Barber"
        ? "barber"
        : null;
      if (
        !role || typeof input.email !== "string" ||
        typeof input.password !== "string" || input.password.length < 12
      ) {
        throw new Error(
          "Correo, rol y contraseña de al menos 12 caracteres requeridos",
        );
      }
      const { data, error } = await db.auth.admin.createUser({
        email: input.email,
        password: input.password,
        email_confirm: true,
      });
      if (error || !data.user) {
        throw new Error(error?.message || "No se pudo crear el usuario");
      }
      const { error: roleError } = await db.from("user_roles").insert({
        user_id: data.user.id,
        role,
      });
      if (roleError) {
        await db.auth.admin.deleteUser(data.user.id);
        throw new Error("No se pudo asignar el rol");
      }
      if (role === "barber" && input.barber_id) {
        const { error: linkError } = await db.from("barbers").update({
          user_id: data.user.id,
        }).eq("id", input.barber_id).is("user_id", null).select().single();
        if (linkError) {
          await db.auth.admin.deleteUser(data.user.id);
          throw new Error("Barbero ya vinculado o inválido");
        }
      }
      return json({ id: data.user.id });
    }
    if (input.action === "update") {
      if (input.id === actor.id) {
        throw new Error(
          "No puedes modificar tu propio acceso desde esta pantalla",
        );
      }
      const patch: Record<string, unknown> = {};
      if (typeof input.active === "boolean") patch.active = input.active;
      if (input.subscription_expires_at !== undefined) {
        patch.subscription_expires_at = input.subscription_expires_at;
      }
      if (input.barber_id !== undefined) patch.barber_id = input.barber_id;
      const { error } = await db.rpc("admin_manage_profile", {
        p_actor: actor.id,
        p_id: input.id,
        p_body: patch,
      });
      if (error) throw new Error("No se pudo actualizar el perfil");
      return json({ success: true });
    }
    return json({ message: "Acción inválida" }, 400);
  } catch (e) {
    return json({
      message: e instanceof Error ? e.message : "Error de usuarios",
    }, 403);
  }
});
