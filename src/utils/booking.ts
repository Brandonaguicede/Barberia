import type { Appointment } from "../types";
export const TIMEZONE = "America/Costa_Rica";
export function localDate(value: string | Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(value));
  const part = (type: string) => parts.find((p) => p.type === type)?.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}
export function localTime(value: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(value));
}
export const privateUrl = (token: string) =>
  `${window.location.origin}/mi-cita/${encodeURIComponent(token)}`;
export function whatsappMessage(a: Appointment, url: string) {
  return `Hola, esta es la información de mi reserva:\n\nBarbería: ${
    a.shop_name || "TENORIO BARBER"
  }\nServicio: ${a.service_name}\nBarbero: ${a.barber_name}\nFecha: ${a.appointment_date}\nHora: ${a.appointment_time}\n\nConsultar, cancelar o reprogramar mi cita:\n${url}\n\n¡Gracias!`;
}
const escapeICS = (v: string) =>
  v.replace(/\\/g, "\\\\").replace(/\r\n|\r|\n/g, "\\n").replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
export function calendarFile(a: Appointment) {
  const format = (v: string) =>
    new Date(v).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const start = a.starts_at ||
    `${a.appointment_date}T${a.appointment_time}:00-06:00`;
  const end = a.ends_at ||
    new Date(new Date(start).getTime() + (a.service_duration || 30) * 60000)
      .toISOString();
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Tenorio Barber//Reservas//ES",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${a.id}@angel-barber`,
    `DTSTAMP:${format(new Date().toISOString())}`,
    `DTSTART:${format(start)}`,
    `DTEND:${format(end)}`,
    `SUMMARY:${escapeICS(`${a.service_name} - ${a.barber_name}`)}`,
    `DESCRIPTION:${escapeICS(a.shop_name || "TENORIO BARBER")}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return lines.map((line) => {
    let out = "", n = 0;
    for (const char of line) {
      const bytes = new TextEncoder().encode(char).length;
      if (n + bytes > 75) {
        out += "\r\n ";
        n = 1;
      }
      out += char;
      n += bytes;
    }
    return out;
  }).join("\r\n") + "\r\n";
}
export function download(
  name: string,
  content: string,
  type = "text/plain;charset=utf-8",
) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
