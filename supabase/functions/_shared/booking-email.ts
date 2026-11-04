import { admin, origin } from "./http.ts";

type BookingReceipt = {
  id?: string;
  client_name?: string;
  client_email?: string | null;
  client_phone?: string;
  service_name?: string;
  service_duration?: number;
  service_price?: number;
  appointment_date?: string;
  appointment_time?: string;
  barber_id?: string;
  barber_name?: string;
  shop_name?: string;
};

/** Best-effort email: a mail provider outage must never undo a confirmed booking. */
export async function sendBookingEmails(
  db: ReturnType<typeof admin>,
  receipt: BookingReceipt,
  accessToken: string,
) {
  const endpoint = Deno.env.get("GOOGLE_APPS_SCRIPT_URL");
  const secret = Deno.env.get("GOOGLE_APPS_SCRIPT_SECRET");
  if (!endpoint || !secret || !receipt.id || !receipt.barber_id) return;

  try {
    const { data: barber, error } = await db.from("barbers").select(
      "email",
    ).eq("id", receipt.barber_id).single();
    if (error) throw error;

    const originUrl = origin().replace(/\/$/, "");
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      redirect: "follow",
      body: JSON.stringify({
        secret,
        booking: {
          appointmentId: receipt.id,
          customerName: receipt.client_name,
          customerEmail: receipt.client_email,
          customerPhone: receipt.client_phone,
          serviceName: receipt.service_name,
          serviceDuration: receipt.service_duration,
          servicePrice: receipt.service_price,
          date: receipt.appointment_date,
          time: receipt.appointment_time,
          barberName: receipt.barber_name,
          barberEmail: barber?.email,
          shopName: receipt.shop_name,
          customerUrl: `${originUrl}/mi-cita/${encodeURIComponent(accessToken)}`,
          staffUrl: `${originUrl}/admin/citas?appointment=${encodeURIComponent(receipt.id)}`,
        },
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) {
      console.error("Booking email bridge returned HTTP", response.status);
      return;
    }
    const result = await response.json().catch(() => null);
    if (result?.ok !== true) {
      console.error("Booking email bridge did not confirm delivery");
    }
  } catch (error) {
    console.error(
      "Booking email notification failed",
      error instanceof Error ? error.message : "unknown error",
    );
  }
}
