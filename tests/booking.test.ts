import { test } from "node:test";
import assert from "node:assert/strict";
import {
  calendarFile,
  localDate,
  localTime,
  whatsappMessage,
} from "../src/utils/booking.ts";
import type { Appointment } from "../src/types/index.ts";
const appointment = {
  id: "appointment-123",
  client_name: "Ana",
  client_phone: "88881234",
  barber_id: "b",
  service_id: "s",
  appointment_date: "2026-10-31",
  appointment_time: "09:00",
  status: "confirmed",
  created_at: "",
  updated_at: "",
  service_name: "Corte; especial, con\nsalto",
  barber_name: "Ángel",
  service_duration: 45,
  service_price: 8000,
  starts_at: "2026-10-31T15:00:00Z",
  ends_at: "2026-10-31T15:45:00Z",
} as Appointment;
test("día y hora de Costa Rica en el límite UTC", () => {
  assert.equal(localDate("2026-11-01T02:00:00Z"), "2026-10-31");
  assert.equal(localTime("2026-11-01T02:00:00Z"), "20:00");
});
test("calendario UTC conserva duración, escapa texto y no expone el token", () => {
  const ics = calendarFile(appointment);
  assert.match(ics, /DTSTART:20261031T150000Z/);
  assert.match(ics, /DTEND:20261031T154500Z/);
  assert.ok(ics.includes("Corte\\; especial\\, con\\nsalto"));
  assert.ok(!ics.includes("/mi-cita/"));
  assert.ok(ics.endsWith("\r\n"));
});
test("WhatsApp conserva el enlace y codifica texto en un solo parámetro", () => {
  const url = "https://example.vercel.app/mi-cita/abc";
  const msg = whatsappMessage(appointment, url);
  const href = new URL(`https://wa.me/?text=${encodeURIComponent(msg)}`);
  assert.equal(href.searchParams.get("text"), msg);
  assert.ok(msg.includes(url));
  assert.ok(msg.includes("09:00"));
});
test("ICS pliega líneas por octetos UTF-8", () => {
  const ics = calendarFile({ ...appointment, service_name: "Á".repeat(100) });
  for (const line of ics.split("\r\n")) {
    assert.ok(Buffer.byteLength(line) <= 75);
  }
});
