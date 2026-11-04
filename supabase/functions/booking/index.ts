import {
  admin,
  body,
  hash,
  json,
  limit,
  preflight,
  serve,
  token,
} from "../_shared/http.ts";
import { sendBookingEmails } from "../_shared/booking-email.ts";

serve(async (req) => {
  const early = preflight(req);
  if (early) return early;
  try {
    await limit(req, "booking", 100);
    const input = await body(req), db = admin(), action = input.action;
    if (action === "catalog") {
      const [b, s, links, settings, schedules] = await Promise.all([
        db.from("barbers").select("id,name,specialty,active").eq(
          "active",
          true,
        ),
        db.from("services").select(
          "id,name,description,duration,price,category,active",
        ).eq("active", true),
        db.from("barber_services").select("barber_id,service_id"),
        db.from("booking_settings").select("shop_name,horizon_days").eq(
          "id",
          true,
        ).single(),
        db.from("barber_schedules").select("barber_id,weekday"),
      ]);
      if (b.error || s.error || links.error || settings.error || schedules.error) {
        throw new Error("Catálogo no disponible");
      }
      return json({
        barbers: b.data,
        services: s.data,
        barber_services: links.data,
        working_weekdays: schedules.data,
        settings: settings.data,
      });
    }
    if (action === "slots") {
      const date = String(input.date || "");
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("Fecha inválida");
      let exclude: string | null = null, duration: number | null = null;
      let service = input.service_id, barber = input.barber_id || null;
      if (input.token) {
        const { data, error } = await db.rpc("private_booking", {
          p_hash: await hash(String(input.token)),
          p_action: "get",
        });
        if (error || !data?.can_reschedule) {
          throw new Error("Enlace inválido o plazo vencido");
        }
        exclude = data.id;
        duration = data.service_duration;
        service = data.service_id;
        barber = data.barber_id;
      }
      const { data, error } = await db.rpc("available_slots", {
        p_service: service,
        p_barber: barber,
        p_date: date,
        p_exclude: exclude,
        p_duration: duration,
      });
      if (error) throw new Error("No se pudo consultar la disponibilidad");
      return json(data);
    }
    if (action === "create") {
      await limit(req, "create", 8);
      const raw = token(),
        payload = input.appointment as Record<string, unknown>;
      if (!payload || typeof payload !== "object") {
        throw new Error("Datos inválidos");
      }
      const clientEmail = typeof payload.client_email === "string"
        ? payload.client_email.trim()
        : "";
      if (
        clientEmail.length > 254 ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clientEmail)
      ) {
        return json({ message: "Ingresa un correo válido para recibir la confirmación." }, 400);
      }
      payload.client_email = clientEmail;
      const { data, error } = await db.rpc("create_booking", {
        p_body: payload,
        p_hash: await hash(raw),
      });
      if (error) {
        return json({
          message: error.code === "23P01"
            ? "Ese horario acaba de ser reservado. Elige otro."
            : error.message,
        }, 409);
      }
      await sendBookingEmails(db, data, raw);
      return json({ ...data, access_token: raw });
    }
    if (["get", "cancel", "reschedule"].includes(String(action))) {
      const raw = String(input.token || "");
      if (!/^[a-f0-9]{64}$/.test(raw)) {
        throw new Error("Enlace inválido o vencido");
      }
      await limit(
        req,
        `private:${await hash(raw)}`,
        action === "get" ? 40 : 10,
      );
      const next = action === "reschedule" ? token() : null;
      const { data, error } = await db.rpc("private_booking", {
        p_hash: await hash(raw),
        p_action: action,
        p_body: input.appointment || {},
        p_new_hash: next ? await hash(next) : null,
      });
      if (error) {
        return json({
          message: error.code === "P0002"
            ? "Enlace inválido o vencido"
            : error.code === "23P01"
            ? "Horario no disponible"
            : error.message,
        }, 409);
      }
      return json({ ...data, ...(next ? { access_token: next } : {}) });
    }
    return json({ message: "Acción inválida" }, 400);
  } catch (e) {
    return json({
      message: e instanceof Error
        ? e.message
        : "No se pudo procesar la solicitud",
    }, 400);
  }
});
