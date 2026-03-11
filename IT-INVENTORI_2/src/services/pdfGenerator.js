const fs = require("fs");
const path = require("path");
const { PDFDocument, StandardFonts } = require("pdf-lib");

const TEMPLATE_PDF = path.join(__dirname, "..", "..", "templates", "documentos", "Formato_ESIM.pdf");

// --- CONFIGURACIÓN DE COORDENADAS (EDITA AQUÍ) -----------------------------
// Las coordenadas vienen del análisis del PDF (X0,Y0,X1,Y1) y se han
// convertido a puntos centrales (x, yTop) con origen en la esquina
// SUPERIOR izquierda de la página (como en la tabla que compartiste).
//
// pdf-lib usa origen en la esquina INFERIOR izquierda, así que en el
// código convertimos internamente con: y = height - yTop.
const ESIM_LAYOUT = {
  empleado: {
    // {nombre_completo} celda "Nombre:"
    nombre: { x: 125.35, yTop: 145.0, size: 10 },
    // {nombre_completo} celda "Usuario:" (parte derecha de la fila de correo/tel)
    usuario: { x: 424.62, yTop: 171.0, size: 10 },
    // {nombre_completo} celda "RECIBE: Nombre" en la tabla inferior
    recibeNombre: { x: 367.69, yTop: 695.15, size: 10 },
    // {ticket} celda "Ticket: #"
    ticket: { x: 293.90, yTop: 148.14, size: 11 },
    // {area} celda "Área/Departamento:"
    area: { x: 465.86, yTop: 145.0, size: 11 },
    // {correo} en fila "E-mail:"
    correo: { x: 111.36, yTop: 171.0, size: 10 }
  },
  // IMEI/IMSI en la fila "IMSI: {imsi}"
  imsi: { x: 298.07, yTop: 194.54, size: 11 },
  // Resumen inferior
  resumen: {
    // {reemplazo_sim} en "¿Reemplazo de eSIM?"
    reemplazo: { x: 99.65, yTop: 518.85, size: 10 },
    // {icc} en "ICC final"
    icc: { x: 196.53, yTop: 512.60, size: 10 },
    // {msisdn} en "MSISDN"
    msisdn: { x: 435.25, yTop: 512.60, size: 10 }
  },
  // Fechas en la tabla de firmas (ENTREGA/RECIBE)
  fechas: {
    entrega: { x: 138.34, yTop: 741.17, size: 10 },
    recibe: { x: 363.44, yTop: 741.17, size: 10 }
  },
  // QR -> usamos el centro del placeholder {%qr_esim}
  qr: {
    x: 286.13,
    yTop: 355.91,
    size: 140
  }
};

// Limpia texto de caracteres que la fuente WinAnsi no puede codificar (ej. U+200B)
function sanitizeText(value) {
  if (value == null) return "";
  let str = String(value);
  // Eliminar espacios de ancho cero y BOM
  str = str.replace(/[\u200B-\u200D\uFEFF]/g, "");
  // Eliminar otros caracteres de control no imprimibles
  str = str.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "");
  return str;
}

/**
 * Genera un PDF para eSIM usando como fondo Formato_ESIM.pdf
 * y dibujando encima los datos y el QR en coordenadas fijas.
 * @param {object} data
 * @returns {Promise<Buffer>}
 */
async function generateEsimPdf(data) {
  if (!fs.existsSync(TEMPLATE_PDF)) {
    throw new Error(`Plantilla PDF de eSIM no encontrada en: ${TEMPLATE_PDF}`);
  }

  const existingPdfBytes = fs.readFileSync(TEMPLATE_PDF);
  const pdfDoc = await PDFDocument.load(existingPdfBytes);
  const pages = pdfDoc.getPages();
  const page = pages[0];

  const { width, height } = page.getSize();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

  const nombreCompleto = sanitizeText(
    (data.nombre_completo || `${data.nombre || ""} ${data.apellidos || ""}`.trim()).toUpperCase()
  );

  // Ajusta estas coordenadas según tu diseño en Formato_ESIM.pdf
  // (sistema de coordenadas PDF: (0,0) esquina inferior izquierda)

  // Datos del colaborador (fila superior)
  if (nombreCompleto) {
    const pos = ESIM_LAYOUT.empleado.nombre;
    page.drawText(nombreCompleto, {
      x: pos.x,
      y: height - pos.yTop,
      size: pos.size,
      font
    });
  }
  if (data.ticket) {
    const pos = ESIM_LAYOUT.empleado.ticket;
    page.drawText(sanitizeText(data.ticket), {
      x: pos.x,
      y: height - pos.yTop,
      size: pos.size,
      font
    });
  }
  if (data.area || data.puesto) {
    const pos = ESIM_LAYOUT.empleado.area;
    page.drawText(sanitizeText(data.area || data.puesto), {
      x: pos.x,
      y: height - pos.yTop,
      size: pos.size,
      font
    });
  }

  // Correo electrónico en la fila "E-mail:"
  if (data.correo) {
    const pos = ESIM_LAYOUT.empleado.correo;
    page.drawText(sanitizeText(data.correo), {
      x: pos.x,
      y: height - pos.yTop,
      size: pos.size,
      font
    });
  }

  // Nombre también en "Usuario: {nombre_completo}" y en "RECIBE: Nombre"
  if (nombreCompleto) {
    const posUsuario = ESIM_LAYOUT.empleado.usuario;
    page.drawText(nombreCompleto, {
      x: posUsuario.x,
      y: height - posUsuario.yTop,
      size: posUsuario.size,
      font
    });

    const posRecibe = ESIM_LAYOUT.empleado.recibeNombre;
    page.drawText(nombreCompleto, {
      x: posRecibe.x,
      y: height - posRecibe.yTop,
      size: posRecibe.size,
      font
    });
  }

  // IMSI en la fila "IMSI: {imsi}"
  if (data.imsi) {
    const pos = ESIM_LAYOUT.imsi;
    page.drawText(sanitizeText(data.imsi), {
      x: pos.x,
      y: height - pos.yTop,
      size: pos.size,
      font
    });
  }

  // Fila inferior de resumen: Reemplazo / ICC final / MSISDN
  if (typeof data.reemplazo_sim !== "undefined") {
    const pos = ESIM_LAYOUT.resumen.reemplazo;
    page.drawText(sanitizeText(data.reemplazo_sim), {
      x: pos.x,
      y: height - pos.yTop,
      size: pos.size,
      font
    });
  }
  if (data.icc) {
    const pos = ESIM_LAYOUT.resumen.icc;
    page.drawText(sanitizeText(data.icc), {
      x: pos.x,
      y: height - pos.yTop,
      size: pos.size,
      font
    });
  }
  if (data.msisdn || data.numero_celular) {
    const pos = ESIM_LAYOUT.resumen.msisdn;
    page.drawText(sanitizeText(data.msisdn || data.numero_celular), {
      x: pos.x,
      y: height - pos.yTop,
      size: pos.size,
      font
    });
  }

  // Fechas de asignación en la tabla de firmas
  if (data.fecha_asignacion || data.fecha) {
    const fechaTxt = sanitizeText(data.fecha_asignacion || data.fecha);
    const posEnt = ESIM_LAYOUT.fechas.entrega;
    const posRec = ESIM_LAYOUT.fechas.recibe;
    page.drawText(fechaTxt, {
      x: posEnt.x,
      y: height - posEnt.yTop,
      size: posEnt.size,
      font
    });
    page.drawText(fechaTxt, {
      x: posRec.x,
      y: height - posRec.yTop,
      size: posRec.size,
      font
    });
  }

  // QR en coordenadas fijas dentro del formato
  const qrPath = data.qr_esim_abs;
  if (qrPath && fs.existsSync(qrPath)) {
    try {
      const qrBytes = fs.readFileSync(qrPath);
      const ext = path.extname(qrPath).toLowerCase();
      const isPng = ext === ".png";
      const qrImage = isPng ? await pdfDoc.embedPng(qrBytes) : await pdfDoc.embedJpg(qrBytes);

      const qrSize = ESIM_LAYOUT.qr.size;
      const centerX = ESIM_LAYOUT.qr.x;
      const centerYTop = ESIM_LAYOUT.qr.yTop;
      const qrX = centerX - qrSize / 2;
      const qrY = height - centerYTop - qrSize / 2;

      page.drawImage(qrImage, {
        x: qrX,
        y: qrY,
        width: qrSize,
        height: qrSize
      });
    } catch (e) {
      // Si falla la incrustación del QR, continuamos sin romper el PDF.
    }
  }

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}

module.exports = {
  generateEsimPdf
};

