/**
 * Servicio para rellenar plantillas Word (.docx) con datos.
 * Las plantillas se guardan en templates/documentos/ y usan placeholders {nombre}, {apellidos}, etc.
 *
 * Cómo usar en Word:
 * - Escribe los placeholders entre llaves: {nombre}, {ticket}, {marca}, {modelo}
 * - Para listas (varios equipos): {#computadoras} {marca} {modelo} {serie} {/computadoras}
 * - Documentación: https://docxtemplater.com/docs/
 */

const Docxtemplater = require("docxtemplater");
const PizZip = require("pizzip");
const path = require("path");
const fs = require("fs");

const TEMPLATES_DIR = path.join(__dirname, "..", "..", "templates", "documentos");

/**
 * Genera un documento Word a partir de una plantilla .docx y un objeto de datos.
 * @param {string} templateName - Nombre del archivo (ej: "FormatoComputo.docx")
 * @param {object} data - Objeto con los datos para rellenar (las claves deben coincidir con los {placeholders} del Word)
 * @returns {Buffer} - Contenido del .docx generado
 */
function generateDocx(templateName, data) {
  const templatePath = path.join(TEMPLATES_DIR, templateName);
  if (!fs.existsSync(templatePath)) {
    throw new Error(`Plantilla no encontrada: ${templateName}. Coloca el archivo en: ${TEMPLATES_DIR}`);
  }

  const content = fs.readFileSync(templatePath);
  const zip = new PizZip(content);
  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
    nullGetter: () => ""
  });

  doc.render(data);
  return doc.getZip().generate({
    type: "nodebuffer",
    compression: "DEFLATE"
  });
}

/**
 * Lista los nombres de plantillas .docx disponibles en la carpeta de documentos.
 * @returns {string[]}
 */
function listTemplates() {
  if (!fs.existsSync(TEMPLATES_DIR)) {
    return [];
  }
  return fs.readdirSync(TEMPLATES_DIR).filter((f) => f.endsWith(".docx"));
}

module.exports = {
  generateDocx,
  listTemplates,
  TEMPLATES_DIR
};
