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

    let sent = 0;
    const customerEmail = validEmail_(b.customerEmail);
    if (customerEmail) {
      sendEmail_(
        customerEmail,
        `Cita confirmada · ${safeText_(b.shopName || "Tenorio Barber")}`,
        customerEmailHtml_(b),
      );
      sent++;
    }

    const barberEmail = validEmail_(b.barberEmail);
    if (barberEmail) {
      sendEmail_(
        barberEmail,
        `Nueva cita · ${safeText_(b.customerName)}`,
        barberEmailHtml_(b),
      );
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

function customerEmailHtml_(b) {
  const customer = escapeHtml_(safeText_(b.customerName));
  const service = escapeHtml_(safeText_(b.serviceName));
  const duration = `${Number(b.serviceDuration) || 0} minutos`;
  const rows = [
    emailRow_("▦", "Fecha", formatDate_(b.date)),
    emailRow_("◷", "Hora", safeText_(b.time)),
    emailRow_("♙", "Barbero", safeText_(b.barberName)),
    emailRow_("◴", "Duración", duration),
  ].join("");
  const manageButton = safeUrl_(b.customerUrl)
    ? emailButton_(b.customerUrl, "Ver o gestionar mi cita")
    : "";
  const manageNote = manageButton
    ? '<p style="margin:11px 0 0;color:#a5a9b1;font-family:Arial,sans-serif;font-size:12px;line-height:1.6;text-align:center">Desde tu enlace podés consultar, cancelar o reprogramar tu cita según disponibilidad.</p>'
    : "";

  return emailLayout_({
    eyebrow: "DETALLES DE TU RESERVA",
    status: "Confirmada",
    heading: "¡Tu cita está confirmada!",
    intro: `¡Hola, ${customer}! Tu próximo corte ya está agendado. Te esperamos.`,
    service,
    rows,
    total: formatPrice_(b.servicePrice),
    button: manageButton,
    note: manageNote,
  });
}

function barberEmailHtml_(b) {
  const barber = escapeHtml_(safeText_(b.barberName || "el equipo"));
  const service = escapeHtml_(safeText_(b.serviceName));
  const rows = [
    emailRow_("♙", "Cliente", safeText_(b.customerName)),
    emailRow_("☎", "Teléfono", safeText_(b.customerPhone)),
    emailRow_("▦", "Fecha", formatDate_(b.date)),
    emailRow_("◷", "Hora", safeText_(b.time)),
    emailRow_("◴", "Duración", `${Number(b.serviceDuration) || 0} minutos`),
  ].join("");
  const staffButton = safeUrl_(b.staffUrl)
    ? emailButton_(b.staffUrl, "Abrir cita en el panel")
    : "";

  return emailLayout_({
    eyebrow: "DETALLES DE LA RESERVA",
    status: "Nueva cita",
    heading: "Nueva cita confirmada",
    intro: `Hola, ${barber}. Tienes una nueva reserva en tu agenda.`,
    service,
    rows,
    total: formatPrice_(b.servicePrice),
    button: staffButton,
    note: "",
  });
}

function emailLayout_(content) {
  return `<div style="margin:0;padding:6px;background:#050607;color:#f4f5f7;font-family:Arial,Helvetica,sans-serif">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-collapse:collapse">
      <tr><td align="center" style="padding:0">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:760px;border-collapse:separate;border-spacing:0;background:#101216;border:1px solid #17191d;border-radius:16px;overflow:hidden">
          <tr><td align="center" style="padding:28px 20px 25px">
            <div style="color:#f3344c;font-size:25px;line-height:1">✂</div>
            <div style="margin-top:8px;color:#f7f7f8;font-size:19px;font-weight:800;line-height:1.2">TENORIO</div>
            <div style="margin-top:5px;color:#c5c6ca;font-size:12px;font-weight:700;letter-spacing:4px">BARBER</div>
          </td></tr>
          <tr><td style="height:1px;background:#ef2944;font-size:0;line-height:0">&nbsp;</td></tr>
          <tr><td align="center" style="padding:28px 20px 20px">
            <div style="display:inline-block;width:19px;height:19px;border:2px solid #fa3b54;border-radius:50%;color:#fa3b54;font-size:15px;font-weight:700;line-height:19px;text-align:center">✓</div>
            <h1 style="margin:13px 0 8px;color:#f5f5f6;font-family:Arial,Helvetica,sans-serif;font-size:20px;font-weight:750;line-height:1.35">${content.heading}</h1>
            <p style="margin:0;color:#b4b6bd;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.65">${content.intro}</p>
          </td></tr>
          <tr><td style="padding:0 12px">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;border-collapse:separate;border-spacing:0;background:#1b1e23;border-radius:13px">
              <tr><td style="padding:16px 12px 9px">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-collapse:collapse"><tr>
                  <td style="color:#afb1b8;font-size:11px;line-height:1.5">${content.eyebrow}</td>
                  <td align="right"><span style="display:inline-block;padding:4px 9px;border-radius:20px;background:#073b26;color:#12ce73;font-size:10px;font-weight:700;line-height:1.2">${content.status}</span></td>
                </tr></table>
                <h2 style="margin:15px 0 16px;color:#f5f5f6;font-family:Arial,Helvetica,sans-serif;font-size:17px;font-weight:700;line-height:1.4">${content.service}</h2>
                <div style="height:1px;background:#363940;font-size:0;line-height:0">&nbsp;</div>
              </td></tr>
              <tr><td style="padding:6px 12px 10px">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;border-collapse:collapse">${content.rows}</table>
              </td></tr>
              <tr><td style="padding:0 12px"><div style="height:1px;background:#363940;font-size:0;line-height:0">&nbsp;</div></td></tr>
              <tr><td style="padding:15px 12px 16px">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-collapse:collapse"><tr>
                  <td style="color:#f1f1f3;font-size:14px;font-weight:700">Total</td>
                  <td align="right" style="color:#f7f7f8;font-size:16px;font-weight:800">${content.total}</td>
                </tr></table>
              </td></tr>
            </table>
          </td></tr>
          ${content.button ? `<tr><td style="padding:12px 12px 0">${content.button}${content.note}</td></tr>` : ""}
          <tr><td style="padding:23px 12px 18px">
            <div style="height:1px;background:#363940;font-size:0;line-height:0">&nbsp;</div>
            <p style="margin:27px 0 4px;color:#f0f0f2;font-size:12px;font-weight:700;text-align:center">TENORIO BARBER</p>
            <p style="margin:0;color:#a5a8b0;font-size:13px;line-height:1.5;text-align:center">Tu estilo empieza aquí · Costa Rica</p>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </div>`;
}

function emailRow_(icon, label, value) {
  return `<tr>
    <td style="padding:9px 0;color:#aeb0b8;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.45;white-space:nowrap"><span style="display:inline-block;width:22px;color:#f43b53;font-size:15px;font-weight:700">${icon}</span>${escapeHtml_(label)}</td>
    <td align="right" style="padding:9px 0;color:#f2f2f4;font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:700;line-height:1.45">${escapeHtml_(value || "Por confirmar")}</td>
  </tr>`;
}

function emailButton_(url, label) {
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;border-collapse:separate;border-spacing:0"><tr><td align="center" bgcolor="#e92742" style="padding:14px 16px;background:#e92742;border-radius:11px">
    <a href="${escapeHtml_(url)}" style="display:block;color:#ffffff;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:700;line-height:1.4;text-align:center;text-decoration:none">${escapeHtml_(label)} &nbsp;→</a>
  </td></tr></table>`;
}

function sendEmail_(to, subject, htmlBody) {
  const plainBody = htmlBody
    .replace(/<a\b[^>]*href=(["'])(.*?)\1[^>]*>([\s\S]*?)<\/a>/gi, "$3: $2")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|h1|h2|td|tr|div)>/gi, "\n")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  MailApp.sendEmail({
    to,
    subject: subject.replace(/[\r\n]/g, " ").slice(0, 180),
    body: plainBody,
    htmlBody,
    name: "Tenorio Barber",
  });
}

function formatDate_(iso) {
  const match = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return escapeHtml_(safeText_(iso));
  const months = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
  return `${match[3]} ${months[Number(match[2]) - 1]} ${match[1]}`;
}

function formatPrice_(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "Por confirmar";
  return `₡${Math.round(amount).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".")}`;
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
