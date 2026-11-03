import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import toast from "../../services/toast";
import type { Appointment } from "../../types";
import { privateBookingApi } from "../../services/api";
import { localDate, localTime, privateUrl } from "../../utils/booking";
import BookingReceipt from "../../components/client/BookingReceipt";
import { FormField, Input, Select } from "../../components/shared/FormField";
import styles from "./ConfirmationPage.module.css";
export default function PrivateBookingPage() {
  const { token = "" } = useParams(), navigate = useNavigate();
  const [a, setA] = useState<Appointment | null>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false);
  const [date, setDate] = useState(""),
    [time, setTime] = useState(""),
    [slots, setSlots] = useState<string[]>([]),
    [loadingSlots, setLoadingSlots] = useState(false);
  const [cancelling, setCancelling] = useState(false),
    [rescheduling, setRescheduling] = useState(false);
  useEffect(() => {
    let live = true;
    setLoading(true);
    setError("");
    setA(null);
    privateBookingApi.get(token).then((v) => {
      if (live) setA(v);
    }).catch((e) => {
      if (live) setError(e.message);
    }).finally(() => {
      if (live) setLoading(false);
    });
    return () => {
      live = false;
    };
  }, [token]);
  useEffect(() => {
    let live = true;
    setSlots([]);
    setTime("");
    if (!date) return;
    setLoadingSlots(true);
    privateBookingApi.slots(token, date).then((s) => {
      if (live) {
        setSlots([...new Set(s.map((v) => localTime(v.starts_at)))].sort());
      }
    }).catch((e) => toast.error(e.message)).finally(() => {
      if (live) setLoadingSlots(false);
    });
    return () => {
      live = false;
    };
  }, [date, token]);
  const cancel = async () => {
    setBusy(true);
    try {
      setA(await privateBookingApi.cancel(token));
      setCancelling(false);
      toast.success("Cita cancelada");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const reschedule = async () => {
    setBusy(true);
    try {
      const next = await privateBookingApi.reschedule(token, {
        appointment_date: date,
        appointment_time: time,
      });
      if (!next.access_token) throw new Error("No se recibió el nuevo enlace");
      setRescheduling(false);
      setDate("");
      navigate(`/mi-cita/${next.access_token}`, { replace: true });
      toast.success("Cita reprogramada. Guarda el nuevo enlace.");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className={styles.page}>
      <h1 className={styles.title}>Mi cita</h1>
      {loading
        ? <p role="status">Consultando tu cita…</p>
        : error
        ? (
          <div role="alert">
            <p>{error}</p>
            <Link className="action-button" to="/">Reservar una cita</Link>
          </div>
        )
        : a && (
          <>
            <BookingReceipt appointment={a} url={privateUrl(token)} />
            <div className="action-row">
              {a.can_reschedule && (
                <button
                  className="action-button"
                  disabled={busy}
                  onClick={() => {
                    setRescheduling(!rescheduling);
                    setCancelling(false);
                  }}
                >
                  Reprogramar
                </button>
              )}
              {a.can_cancel && (
                <button
                  className="action-button"
                  disabled={busy}
                  onClick={() => {
                    setCancelling(true);
                    setRescheduling(false);
                  }}
                >
                  Cancelar cita
                </button>
              )}
            </div>
            {cancelling && (
              <div
                className="operation-panel"
                role="group"
                aria-label="Confirmar cancelación"
              >
                <p>
                  ¿Cancelar tu cita del {a.appointment_date} a las{" "}
                  {a.appointment_time}? El horario quedará disponible.
                </p>
                <div className="action-row">
                  <button
                    className="action-button"
                    disabled={busy}
                    onClick={() => void cancel()}
                  >
                    {busy ? "Cancelando…" : "Sí, cancelar mi cita"}
                  </button>
                  <button
                    className="action-button"
                    disabled={busy}
                    onClick={() => setCancelling(false)}
                  >
                    Conservar cita
                  </button>
                </div>
              </div>
            )}
            {rescheduling && (
              <div className="operation-panel">
                <h2>Elegir otro horario</h2>
                <FormField label="Nueva fecha">
                  <Input
                    type="date"
                    min={localDate()}
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                  />
                </FormField>
                <FormField label="Nueva hora">
                  <Select
                    value={time}
                    disabled={loadingSlots}
                    onChange={(e) => setTime(e.target.value)}
                  >
                    <option value="">
                      {loadingSlots ? "Consultando…" : "Seleccionar horario"}
                    </option>
                    {slots.map((s) => <option key={s}>{s}</option>)}
                  </Select>
                </FormField>
                {date && !loadingSlots && slots.length === 0 && (
                  <p>No hay horarios disponibles para este día.</p>
                )}
                <button
                  className="action-button"
                  disabled={busy || !date || !time}
                  onClick={() => void reschedule()}
                >
                  {busy ? "Reprogramando…" : "Confirmar nuevo horario"}
                </button>
              </div>
            )}
            {!a.can_cancel && !a.can_reschedule && a.status === "confirmed" && (
              <p>El plazo para modificar esta cita ha vencido.</p>
            )}
            <p className="muted">
              Cancelación y reprogramación disponibles hasta el plazo
              configurado por la barbería, inicialmente 2 horas antes.
            </p>
          </>
        )}
    </section>
  );
}
