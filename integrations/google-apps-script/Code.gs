/**
 * Free Gmail notifications for confirmed barber appointments.
 * Deploy as a web app that executes as the owner. The shared secret is stored
 * in Script Properties (MAILER_SECRET), never in this source file.
 */
function doPost(e) {
  try {
    const payload = JSON.parse((e && e.postData && e.postData.contents) || "{}");
    const configuredSecret = PropertiesService.getScriptProperties()
      .getProperty("MAILER_SECRET");
    if (!configuredSecret || !constantTimeEquals_(payload.secret, configuredSecret)) {
      return json_({ ok: false, error: "unauthorized" });
    }

    const b = payload.booking || {};
    if (!b.appointmentId || !b.customerName || !b.serviceName || !b.date || !b.time) {
      return json_({ ok: false, error: "invalid_booking" });
    }

    const details = [
      ["Servicio", `${safeText_(b.serviceName)} (${Number(b.serviceDuration) || 0} min)`],
      ["Barbero", safeText_(b.barberName)],
      ["Fecha", formatDate_(b.date)],
      ["Hora", safeText_(b.time)],
      ["Precio", formatPrice_(b.servicePrice)],
    ];

    let sent = 0;
    const customerEmail = validEmail_(b.customerEmail);
    if (customerEmail) {
      const customerRows = details.map(([label, value]) => row_(label, value)).join("");
      const manageButton = safeUrl_(b.customerUrl)
        ? `<p style="margin:26px 0"><a href="${escapeHtml_(b.customerUrl)}" style="background:#e31d35;color:#fff;padding:13px 20px;border-radius:8px;text-decoration:none;font-weight:700">Ver o gestionar mi cita</a></p>`
        : "";
      sendEmail_(customerEmail, `Cita confirmada · ${safeText_(b.shopName || "Tenorio Barber")}`, emailHtml_(
        `¡Hola, ${safeText_(b.customerName)}!`,
        "Tu cita está confirmada. Guarda este correo para consultar los detalles.",
        customerRows,
        `${manageButton}<p style="color:#9298a3;font-size:12px">Si no solicitaste esta cita, puedes ignorar este mensaje.</p>`,
        b.shopName,
      ));
      sent++;
    }

    const barberEmail = validEmail_(b.barberEmail);
    if (barberEmail) {
      const barberRows = [
        ["Cliente", safeText_(b.customerName)],
        ["Teléfono", safeText_(b.customerPhone)],
        ...details,
      ].map(([label, value]) => row_(label, value)).join("");
      const staffButton = safeUrl_(b.staffUrl)
        ? `<p style="margin:26px 0"><a href="${escapeHtml_(b.staffUrl)}" style="background:#e31d35;color:#fff;padding:13px 20px;border-radius:8px;text-decoration:none;font-weight:700">Abrir cita en el panel</a></p>`
        : "";
      sendEmail_(barberEmail, `Nueva cita · ${safeText_(b.customerName)}`, emailHtml_(
        `Nueva cita para ${safeText_(b.barberName || "el equipo")}`,
        "Se confirmó una nueva reserva.",
        barberRows,
        staffButton,
        b.shopName,
      ));
      sent++;
    }

    return json_({ ok: true, sent });
  } catch (err) {
    console.error("Mailer error", err && err.message ? err.message : "unknown");
    return json_({ ok: false, error: "send_failed" });
  }
}

// Run once from the editor to grant the Gmail send permission before deployment.
function authorizeEmailSending() {
  MailApp.getRemainingDailyQuota();
}

function sendEmail_(to, subject, htmlBody) {
  MailApp.sendEmail({
    to,
    subject: subject.replace(/[\r\n]/g, " ").slice(0, 180),
    body: "Tu correo requiere formato HTML para mostrar los detalles de la cita.",
    htmlBody,
    name: "Tenorio Barber",
  });
}

function emailHtml_(heading, intro, rows, footer, shopName) {
  return `<div style="margin:0;background:#0d1013;padding:32px 14px;font-family:Arial,sans-serif;color:#f4f5f7"><div style="max-width:560px;margin:auto;background:#171b20;border:1px solid #343a42;border-radius:16px;overflow:hidden"><div style="height:4px;background:#e31d35"></div><div style="padding:28px"><p style="margin:0 0 24px;color:#e31d35;font-size:12px;font-weight:700;letter-spacing:3px">${escapeHtml_(shopName || "TENORIO BARBER")}</p><h1 style="font-size:24px;margin:0 0 10px">${heading}</h1><p style="color:#b9bec7;line-height:1.6;margin:0 0 22px">${intro}</p><table style="width:100%;border-collapse:collapse">${rows}</table>${footer}<p style="color:#777f8b;font-size:12px;border-top:1px solid #343a42;padding-top:18px;margin-top:28px">Tenorio Barber · Costa Rica</p></div></div></div>`;
}

function row_(label, value) {
  return `<tr><td style="padding:11px 0;color:#9298a3;border-bottom:1px solid #30353c">${escapeHtml_(label)}</td><td style="padding:11px 0;text-align:right;color:#f4f5f7;font-weight:600;border-bottom:1px solid #30353c">${escapeHtml_(value)}</td></tr>`;
}

function formatDate_(iso) {
  const match = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : safeText_(iso);
}

function formatPrice_(value) {
  const amount = Number(value);
  return Number.isFinite(amount) ? `₡${amount.toLocaleString("es-CR")}` : "Por confirmar";
}

function validEmail_(value) {
  const email = String(value || "").trim();
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : "";
}

function safeText_(value) {
  return String(value || "").replace(/[\r\n\u0000-\u001f]/g, " ").slice(0, 300);
}

function safeUrl_(value) {
  const url = String(value || "");
  return /^https:\/\/[^\s]+$/.test(url) || /^http:\/\/localhost(?::\d+)?\/[^\s]*$/.test(url);
}

function escapeHtml_(value) {
  return String(value || "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[char]);
}

function constantTimeEquals_(candidate, expected) {
  if (typeof candidate !== "string" || candidate.length !== expected.length) return false;
  let difference = 0;
  for (let i = 0; i < expected.length; i++) {
    difference |= candidate.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return difference === 0;
}

function json_(value) {
  return ContentService.createTextOutput(JSON.stringify(value))
    .setMimeType(ContentService.MimeType.JSON);
}
