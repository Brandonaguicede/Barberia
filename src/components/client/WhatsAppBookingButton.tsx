import type { Appointment } from "../../types";
import { whatsappMessage } from "../../utils/booking";
export default function WhatsAppBookingButton(
  { appointment, url }: { appointment: Appointment; url: string },
) {
  return (
    <a
      className="action-button"
      href={`https://wa.me/?text=${
        encodeURIComponent(whatsappMessage(appointment, url))
      }`}
      target="_blank"
      rel="noopener noreferrer"
    >
      Guardar mi cita en WhatsApp
    </a>
  );
}
