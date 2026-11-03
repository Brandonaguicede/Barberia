import toast from "../../services/toast";
import type { Appointment } from "../../types";
import StatusBadge from "../shared/StatusBadge";
import WhatsAppBookingButton from "./WhatsAppBookingButton";
import { calendarFile, download, whatsappMessage } from "../../utils/booking";
import styles from "../../pages/client/ConfirmationPage.module.css";
export default function BookingReceipt(
  { appointment: a, url }: { appointment: Appointment; url: string },
) {
  return (
    <>
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <span className={styles.cardId}>
            Cita #{a.id.slice(0, 8).toUpperCase()}
          </span>
          <StatusBadge status={a.status} />
        </div>
        <dl className="receipt-details">
          <div>
            <dt>Servicio</dt>
            <dd>{a.service_name}</dd>
          </div>
          <div>
            <dt>Barbero</dt>
            <dd>{a.barber_name}</dd>
          </div>
          <div>
            <dt>Fecha</dt>
            <dd>
              {new Date(a.appointment_date + "T12:00:00-06:00")
                .toLocaleDateString("es-CR", {
                  timeZone: "America/Costa_Rica",
                  dateStyle: "long",
                })}
            </dd>
          </div>
          <div>
            <dt>Hora en Costa Rica</dt>
            <dd>{a.appointment_time}</dd>
          </div>
          <div>
            <dt>Duración</dt>
            <dd>{a.service_duration} minutos</dd>
          </div>
          <div>
            <dt>Precio</dt>
            <dd>
              {new Intl.NumberFormat("es-CR", {
                style: "currency",
                currency: "CRC",
              }).format(a.service_price || 0)}
            </dd>
          </div>
          <div>
            <dt>Cliente</dt>
            <dd>{a.client_name}</dd>
          </div>
        </dl>
      </div>
      <div className="action-row">
        <WhatsAppBookingButton appointment={a} url={url} />
        <button
          className="action-button"
          onClick={() => {
            void navigator.clipboard.writeText(url).then(() =>
              toast.success("Enlace copiado")
            ).catch(() =>
              toast.error("No se pudo copiar. Guarda el comprobante.")
            );
          }}
        >
          Copiar enlace
        </button>
        <button
          className="action-button"
          onClick={() => download("mi-cita.txt", whatsappMessage(a, url))}
        >
          Guardar comprobante
        </button>
        {a.status === "confirmed" && (
          <button
            className="action-button"
            onClick={() =>
              download(
                "mi-cita.ics",
                calendarFile(a),
                "text/calendar;charset=utf-8",
              )}
          >
            Añadir al calendario
          </button>
        )}
      </div>
      <p className="muted">
        WhatsApp abrirá el mensaje para que pulses Enviar. Conserva tu enlace
        privado: permite gestionar esta cita.
      </p>
    </>
  );
}
