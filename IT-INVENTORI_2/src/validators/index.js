const { body, validationResult } = require("express-validator");

// Login
const loginRules = [
  body("username").trim().notEmpty().withMessage("Usuario o correo es obligatorio."),
  body("password").notEmpty().withMessage("La contraseña es obligatoria.")
];

function getErrors(req) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return errors.array().map((e) => e.msg);
  }
  return [];
}

function getFieldErrors(req) {
  const errors = validationResult(req);
  const byField = {};
  if (!errors.isEmpty()) {
    errors.array().forEach((e) => {
      const f = e.path;
      if (!byField[f]) byField[f] = [];
      byField[f].push(e.msg);
    });
  }
  return byField;
}

// Datos de colaborador (asignación y edición)
const empleadoRules = [
  body("nombre")
    .trim()
    .notEmpty()
    .withMessage("El nombre es obligatorio.")
    .isLength({ max: 100 })
    .withMessage("El nombre no puede exceder 100 caracteres."),
  body("apellidos")
    .trim()
    .notEmpty()
    .withMessage("Los apellidos son obligatorios.")
    .isLength({ max: 100 })
    .withMessage("Los apellidos no pueden exceder 100 caracteres."),
  body("correo")
    .trim()
    .notEmpty()
    .withMessage("El correo es obligatorio.")
    .isEmail()
    .withMessage("Debe ser un correo electrónico válido.")
    .normalizeEmail(),
  body("puesto")
    .trim()
    .notEmpty()
    .withMessage("El puesto/cargo es obligatorio.")
    .isLength({ max: 100 })
    .withMessage("El puesto no puede exceder 100 caracteres."),
  body("ticket")
    .trim()
    .notEmpty()
    .withMessage("El número de ticket es obligatorio.")
    .isLength({ max: 10 })
    .withMessage("El ticket no puede exceder 10 caracteres.")
];

// Asignación
const asignacionRules = [
  body("nombre")
    .trim()
    .notEmpty()
    .withMessage("El nombre es obligatorio.")
    .isLength({ max: 100 })
    .withMessage("El nombre no puede exceder 100 caracteres."),
  body("apellidos")
    .trim()
    .notEmpty()
    .withMessage("Los apellidos son obligatorios.")
    .isLength({ max: 100 })
    .withMessage("Los apellidos no pueden exceder 100 caracteres."),
  body("correo")
    .trim()
    .notEmpty()
    .withMessage("El correo es obligatorio.")
    .isEmail()
    .withMessage("Debe ser un correo electrónico válido.")
    .normalizeEmail(),
  body("puesto")
    .trim()
    .notEmpty()
    .withMessage("El puesto/cargo es obligatorio.")
    .isLength({ max: 100 })
    .withMessage("El puesto no puede exceder 100 caracteres."),
  body("ticket")
    .trim()
    .notEmpty()
    .withMessage("El número de ticket es obligatorio.")
    .isLength({ max: 10 })
    .withMessage("El ticket no puede exceder 10 caracteres.")
];

// Registrar computadora
const computadoraRules = [
  body("marca")
    .trim()
    .notEmpty()
    .withMessage("La marca es obligatoria.")
    .isLength({ max: 50 })
    .withMessage("La marca no puede exceder 50 caracteres."),
  body("modelo")
    .trim()
    .notEmpty()
    .withMessage("El modelo es obligatorio.")
    .isLength({ max: 50 })
    .withMessage("El modelo no puede exceder 50 caracteres."),
  body("serie")
    .trim()
    .notEmpty()
    .withMessage("La serie es obligatoria.")
    .isLength({ max: 100 })
    .withMessage("La serie no puede exceder 100 caracteres."),
  body("estado").optional().isIn(["Nuevo", "Usado"]).withMessage("Estado inválido.")
];

// Registrar celular
const celularRules = [
  body("marca")
    .trim()
    .notEmpty()
    .withMessage("La marca es obligatoria.")
    .isLength({ max: 50 })
    .withMessage("La marca no puede exceder 50 caracteres."),
  body("modelo")
    .trim()
    .notEmpty()
    .withMessage("El modelo es obligatorio.")
    .isLength({ max: 50 })
    .withMessage("El modelo no puede exceder 50 caracteres."),
  body("serie")
    .trim()
    .notEmpty()
    .withMessage("La serie es obligatoria.")
    .isLength({ max: 100 })
    .withMessage("La serie no puede exceder 100 caracteres."),
  body("imei")
    .optional()
    .trim()
    .isLength({ max: 20 })
    .withMessage("El IMEI no puede exceder 20 caracteres.")
];

// Registrar SIM
const simRules = [
  body("tipo_sim")
    .trim()
    .notEmpty()
    .withMessage("Debes seleccionar el tipo de línea.")
    .isIn(["SIM", "ESIM"])
    .withMessage("Tipo de línea inválido."),
  body("numero_celular")
    .trim()
    .notEmpty()
    .withMessage("El número celular es obligatorio.")
    .isLength({ max: 15 })
    .withMessage("El número no puede exceder 15 caracteres."),
  body("icc")
    .trim()
    .notEmpty()
    .withMessage("El ICC es obligatorio.")
    .isLength({ max: 25 })
    .withMessage("El ICC no puede exceder 25 caracteres."),
  body("imei")
    .trim()
    .notEmpty()
    .withMessage("El IMEI es obligatorio.")
    .isLength({ max: 20 })
    .withMessage("El IMEI no puede exceder 20 caracteres."),
  body("reemplazo_sim")
    .custom((value) => {
      if (value !== "si" && value !== "no") {
        throw new Error("Debes indicar si es reemplazo (sí o no).");
      }
      return true;
    }),
  body("qr_esim")
    .custom((_, { req }) => {
      if (req.body.tipo_sim !== "ESIM") return true;
      if (!req.file) {
        throw new Error("Debes subir la imagen del QR para la eSIM.");
      }
      return true;
    })
];

// Registrar admin
const registroAdminRules = [
  body("username")
    .trim()
    .notEmpty()
    .withMessage("El nombre de usuario es obligatorio.")
    .isLength({ min: 3, max: 150 })
    .withMessage("El usuario debe tener entre 3 y 150 caracteres."),
  body("email")
    .trim()
    .notEmpty()
    .withMessage("El correo es obligatorio.")
    .isEmail()
    .withMessage("Debe ser un correo electrónico válido.")
    .normalizeEmail(),
  body("first_name")
    .trim()
    .notEmpty()
    .withMessage("El nombre de visualización es obligatorio.")
    .isLength({ max: 150 })
    .withMessage("El nombre no puede exceder 150 caracteres."),
  body("password1")
    .notEmpty()
    .withMessage("La contraseña es obligatoria.")
    .isLength({ min: 8 })
    .withMessage("La contraseña debe tener al menos 8 caracteres."),
  body("password2")
    .notEmpty()
    .withMessage("Debes confirmar la contraseña.")
    .custom((value, { req }) => value === req.body.password1)
    .withMessage("Las contraseñas no coinciden.")
];

module.exports = {
  getErrors,
  getFieldErrors,
  loginRules,
  empleadoRules,
  asignacionRules,
  computadoraRules,
  celularRules,
  simRules,
  registroAdminRules
};
