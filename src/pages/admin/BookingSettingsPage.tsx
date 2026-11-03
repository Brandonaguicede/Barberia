import { useEffect, useState } from "react";
import toast from "../../services/toast";
import { supabase } from "../../services/supabase";
import { useAuth } from "../../context/AuthContext";
import type { Barber, Service } from "../../types";
import { barbersApi, servicesApi } from "../../services/api";
import { FormField, Input, Select } from "../../components/shared/FormField";
import styles from "./AdminAppointments.module.css";
interface Settings {
  shop_name: string;
  minimum_notice_minutes: number;
  cancellation_notice_minutes: number;
  reschedule_notice_minutes: number;
  slot_interval_minutes: number;
  buffer_minutes: number;
  horizon_days: number;
  reminder_minutes: number;
  barber_can_manage_availability: boolean;
}
interface Availability {
  id: string;
  barber_id: string;
  weekday?: number;
  opens_at?: string;
  closes_at?: string;
  starts_at: string;
  ends_at: string;
  reason?: string;
}
const days = [
  "Domingo",
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
];
export default function BookingSettingsPage() {
  const { isAdmin, user } = useAuth(),
    [settings, setSettings] = useState<Settings | null>(null),
    [barbers, setBarbers] = useState<Barber[]>([]),
    [services, setServices] = useState<Service[]>([]),
    [barber, setBarber] = useState(""),
    [assigned, setAssigned] = useState<string[]>([]);
  const [mode, setMode] = useState<
      "barber_schedules" | "barber_breaks" | "barber_time_off"
    >("barber_schedules"),
    [rows, setRows] = useState<Availability[]>([]),
    [weekday, setWeekday] = useState("1"),
    [start, setStart] = useState("09:00"),
    [end, setEnd] = useState("18:00"),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const allowed = isAdmin || Boolean(settings?.barber_can_manage_availability);
  const load = async () => {
    if (!barber) return;
    const { data, error } = await supabase.from(mode).select("*").eq(
      "barber_id",
      barber,
    );
    if (error) throw error;
    setRows(data || []);
    const { data: links, error: le } = await supabase.from("barber_services")
      .select("service_id").eq("barber_id", barber);
    if (le) throw le;
    setAssigned((links || []).map((l) => l.service_id));
  };
  useEffect(() => {
    void Promise.all([
      supabase.from("booking_settings").select("*").eq("id", true).single(),
      barbersApi.getAllAdmin(),
      servicesApi.getAllAdmin(),
    ]).then(([s, b, v]) => {
      if (s.error) throw s.error;
      setSettings(s.data);
      setBarbers(b);
      setServices(v);
      setBarber(isAdmin ? b[0]?.id || "" : user?.barber_id || "");
    }).catch(() => setError("No se pudo cargar la configuración"));
  }, [isAdmin, user?.barber_id]);
  useEffect(() => {
    setRows([]);
    setStart(mode === "barber_time_off" ? "" : "09:00");
    setEnd(mode === "barber_time_off" ? "" : "18:00");
    void load().catch(() => setError("No se pudo cargar la disponibilidad"));
  }, [barber, mode]);
  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError("");
    try {
      await fn();
      toast.success("Cambios guardados");
    } catch (e) {
      setError((e as Error).message || "No se pudo guardar");
    } finally {
      setBusy(false);
    }
  };
  const saveSettings = () =>
    run(async () => {
      const { error } = await supabase.from("booking_settings").update(
        settings!,
      ).eq("id", true);
      if (error) throw error;
    });
  const add = () =>
    run(async () => {
      const payload: Record<string, string | number> =
        mode === "barber_time_off"
          ? {
            barber_id: barber,
            starts_at: new Date(`${start}:00-06:00`).toISOString(),
            ends_at: new Date(`${end}:00-06:00`).toISOString(),
          }
          : {
            barber_id: barber,
            weekday: Number(weekday),
            ...(mode === "barber_schedules"
              ? { opens_at: start, closes_at: end }
              : { starts_at: start, ends_at: end }),
          };
      const { error } = await supabase.from(mode).insert(payload);
      if (error) throw error;
      await load();
    });
  const toggleService = (id: string) =>
    run(async () => {
      const q = assigned.includes(id)
        ? supabase.from("barber_services").delete().eq("barber_id", barber).eq(
          "service_id",
          id,
        )
        : supabase.from("barber_services").insert({
          barber_id: barber,
          service_id: id,
        });
      const { error } = await q;
      if (error) throw error;
      await load();
    });
  return (
    <section className={styles.page}>
      <h1 className={styles.title}>
        {isAdmin ? "Configuración de reservas" : "Mi disponibilidad"}
      </h1>
      {error && <p role="alert" className="operation-error">{error}</p>}
      {!settings && !error && <p role="status">Cargando configuración…</p>}
      {isAdmin && settings && (
        <form
          className="operation-panel"
          onSubmit={(e) => {
            e.preventDefault();
            void saveSettings();
          }}
        >
          <h2>Reglas de reservas</h2>
          <div className="settings-grid">
            <FormField label="Nombre de la barbería">
              <Input
                required
                value={settings.shop_name}
                onChange={(e) =>
                  setSettings({ ...settings, shop_name: e.target.value })}
              />
            </FormField>
            {([
              ["minimum_notice_minutes", "Anticipación mínima (min)", 0, 1440],
              [
                "cancellation_notice_minutes",
                "Plazo de cancelación (min)",
                0,
                10080,
              ],
              [
                "reschedule_notice_minutes",
                "Plazo de reprogramación (min)",
                0,
                10080,
              ],
              ["slot_interval_minutes", "Intervalo de agenda (min)", 5, 120],
              ["buffer_minutes", "Tiempo entre servicios (min)", 0, 120],
              ["horizon_days", "Días habilitados para reservar", 1, 365],
              ["reminder_minutes", "Recordatorio previo (min)", 5, 1440],
            ] as const).map(([key, label, min, max]) => (
              <FormField key={key} label={label}>
                <Input
                  type="number"
                  required
                  min={min}
                  max={max}
                  value={settings[key]}
                  onChange={(e) =>
                    setSettings({ ...settings, [key]: Number(e.target.value) })}
                />
              </FormField>
            ))}
            <label>
              <input
                type="checkbox"
                checked={settings.barber_can_manage_availability}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    barber_can_manage_availability: e.target.checked,
                  })}
              />{" "}
              Permitir que los barberos gestionen su disponibilidad
            </label>
          </div>
          <p className="muted">
            Zona horaria: America/Costa_Rica. Los cambios no cancelan citas
            existentes.
          </p>
          <button className="action-button" disabled={busy}>
            Guardar reglas
          </button>
        </form>
      )}
      <div className="operation-panel">
        <h2>Horarios y servicios por barbero</h2>
        <FormField label="Barbero">
          <Select
            value={barber}
            disabled={!isAdmin}
            onChange={(e) => setBarber(e.target.value)}
          >
            <option value="">Seleccionar barbero</option>
            {barbers.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </Select>
        </FormField>
        {isAdmin && barber && (
          <fieldset className="service-assignments">
            <legend>Servicios que ofrece</legend>
            {services.map((s) => (
              <label key={s.id}>
                <input
                  type="checkbox"
                  disabled={busy}
                  checked={assigned.includes(s.id)}
                  onChange={() => void toggleService(s.id)}
                />
                {s.name}
              </label>
            ))}
          </fieldset>
        )}
        <FormField label="Disponibilidad">
          <Select
            value={mode}
            onChange={(e) => setMode(e.target.value as typeof mode)}
          >
            <option value="barber_schedules">Horario semanal</option>
            <option value="barber_breaks">Descansos semanales</option>
            <option value="barber_time_off">Vacaciones y bloqueos</option>
          </Select>
        </FormField>
        {!allowed && (
          <p>
            La administración debe habilitar la edición de tu disponibilidad.
          </p>
        )}
        <ul className="availability-list">
          {rows.map((r) => (
            <li key={r.id}>
              <span>
                {mode === "barber_time_off"
                  ? `${
                    new Date(r.starts_at).toLocaleString("es-CR", {
                      timeZone: "America/Costa_Rica",
                    })
                  } — ${
                    new Date(r.ends_at).toLocaleString("es-CR", {
                      timeZone: "America/Costa_Rica",
                    })
                  }`
                  : `${days[r.weekday!]}: ${
                    (r.opens_at || r.starts_at).slice(0, 5)
                  } — ${(r.closes_at || r.ends_at).slice(0, 5)}`}
              </span>
              {allowed && (
                <button
                  className="action-button"
                  disabled={busy}
                  onClick={() => {
                    if (
                      window.confirm("¿Eliminar esta regla de disponibilidad?")
                    ) {
                      void run(async () => {
                        const { error } = await supabase.from(mode).delete().eq(
                          "id",
                          r.id,
                        );
                        if (error) throw error;
                        await load();
                      });
                    }
                  }}
                >
                  Eliminar
                </button>
              )}
            </li>
          ))}
        </ul>
        {rows.length === 0 && (
          <p>
            No hay reglas en esta categoría. Sin horario semanal no se aceptan
            reservas.
          </p>
        )}
        {allowed && barber && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void add();
            }}
            className="settings-grid"
          >
            {mode !== "barber_time_off" && (
              <FormField label="Día">
                <Select
                  value={weekday}
                  onChange={(e) => setWeekday(e.target.value)}
                >
                  {days.map((d, i) => <option key={d} value={i}>{d}</option>)}
                </Select>
              </FormField>
            )}
            <FormField label="Inicio">
              <Input
                required
                type={mode === "barber_time_off" ? "datetime-local" : "time"}
                value={start}
                onChange={(e) => setStart(e.target.value)}
              />
            </FormField>
            <FormField label="Fin">
              <Input
                required
                type={mode === "barber_time_off" ? "datetime-local" : "time"}
                value={end}
                onChange={(e) => setEnd(e.target.value)}
              />
            </FormField>
            <button className="action-button" disabled={busy}>
              Agregar regla
            </button>
          </form>
        )}
      </div>
    </section>
  );
}
