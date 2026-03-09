/**
 * Inserta 5 computadoras, 5 celulares y 5 SIM cards de prueba.
 * Uso: node scripts/seed-equipos.js
 */
require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });

const { query } = require("../src/utils/db");

const COMPUTADORAS = [
  { marca: "Dell", modelo: "Latitude 5520", serie: "DELL-LAT-001" },
  { marca: "HP", modelo: "EliteBook 840", serie: "HP-ELT-002" },
  { marca: "Lenovo", modelo: "ThinkPad X1 Carbon", serie: "LNV-TPX-003" },
  { marca: "Dell", modelo: "OptiPlex 7090", serie: "DELL-OPT-004" },
  { marca: "Apple", modelo: "MacBook Pro 14", serie: "APL-MBP-005" }
];

const CELULARES = [
  { marca: "Samsung", modelo: "Galaxy A54", serie: "SAM-GAX-001" },
  { marca: "iPhone", modelo: "iPhone 14", serie: "APH-IP14-002" },
  { marca: "Motorola", modelo: "Edge 40", serie: "MOT-EDG-003" },
  { marca: "Xiaomi", modelo: "Redmi Note 12", serie: "XIA-RN12-004" },
  { marca: "Google", modelo: "Pixel 7", serie: "GGL-PX7-005" }
];

const SIM_CARDS = [
  { numero_celular: "5551234501", icc: "89012345678901234567", imei: "355123450123456" },
  { numero_celular: "5551234502", icc: "89012345678901234568", imei: "355123450123457" },
  { numero_celular: "5551234503", icc: "89012345678901234569", imei: "355123450123458" },
  { numero_celular: "5551234504", icc: "89012345678901234570", imei: "355123450123459" },
  { numero_celular: "5551234505", icc: "89012345678901234571", imei: "355123450123460" }
];

async function seed() {
  await require("../src/utils/db").init();

  for (const c of COMPUTADORAS) {
    try {
      await query(
        "INSERT INTO equipos_computadora (marca, modelo, serie, estado) VALUES (?, ?, ?, 'Nuevo')",
        [c.marca, c.modelo, c.serie]
      );
    } catch (e) {
      if (!e.message.includes("UNIQUE")) throw e;
    }
  }

  for (const c of CELULARES) {
    try {
      await query(
        "INSERT INTO equipos_celular (marca, modelo, serie) VALUES (?, ?, ?)",
        [c.marca, c.modelo, c.serie]
      );
    } catch (e) {
      if (!e.message.includes("UNIQUE")) throw e;
    }
  }

  for (const s of SIM_CARDS) {
    try {
      await query(
        "INSERT INTO equipos_simcard (numero_celular, icc, imei) VALUES (?, ?, ?)",
        [s.numero_celular, s.icc, s.imei]
      );
    } catch (e) {
      if (!e.message.includes("UNIQUE")) throw e;
    }
  }

  console.log("Seed completado: 5 computadoras, 5 celulares, 5 SIM cards.");
  process.exit(0);
}

seed().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
