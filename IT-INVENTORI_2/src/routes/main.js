const express = require("express");
const {
  ensureAuthenticated,
  ensureStaff,
  ensureSuperuser
} = require("../middleware/auth");
const { query } = require("../utils/db");
const { makeDjangoPassword } = require("../utils/djangoPassword");
const {
  getErrors,
  getFieldErrors,
  empleadoRules,
  asignacionRules,
  computadoraRules,
  celularRules,
  simRules,
  registroAdminRules
} = require("../validators");
const { generateDocx, listTemplates } = require("../services/docxGenerator");
const { generateEsimPdf } = require("../services/pdfGenerator");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const router = express.Router();

// Configuración de subida de QR de eSIM
const esimUploadDir = path.join(__dirname, "..", "..", "public", "uploads", "esim");
if (!fs.existsSync(esimUploadDir)) {
  fs.mkdirSync(esimUploadDir, { recursive: true });
}

const esimStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, esimUploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || ".png";
    const base = path.basename(file.originalname, ext).replace(/\s+/g, "_");
    cb(null, `${Date.now()}_${base}${ext}`);
  }
});

const uploadEsimQr = multer({
  storage: esimStorage,
  fileFilter: (req, file, cb) => {
    const mime = file.mimetype.toLowerCase();
    if (mime !== "image/png" && mime !== "image/jpeg" && mime !== "image/jpg") {
      return cb(new Error("Solo se permiten imágenes PNG o JPG para el QR de eSIM."));
    }
    cb(null, true);
  },
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB
  }
});

function maybeUploadEsimQr(req, res, next) {
  if (req.params.tipo !== "sim") return next();
  return uploadEsimQr.single("qr_esim")(req, res, next);
}

// Redirigir raíz a /home
router.get("/", ensureAuthenticated, (req, res) => {
  res.redirect("/home");
});

// Dashboard principal (equivalente a equipos.views.home)
router.get("/home", ensureAuthenticated, async (req, res) => {
  try {
    const [
      compTotal,
      compLibres,
      celTotal,
      celLibres,
      simTotal,
      simLibres
    ] = await Promise.all([
      query("SELECT COUNT(*) AS c FROM equipos_computadora"),
      query("SELECT COUNT(*) AS c FROM equipos_computadora WHERE asignado_a_id IS NULL"),
      query("SELECT COUNT(*) AS c FROM equipos_celular"),
      query("SELECT COUNT(*) AS c FROM equipos_celular WHERE asignado_a_id IS NULL"),
      query("SELECT COUNT(*) AS c FROM equipos_simcard"),
      query("SELECT COUNT(*) AS c FROM equipos_simcard WHERE asignado_a_id IS NULL")
    ]);

    function porcentaje(libres, total) {
      if (!total) return 0;
      return Math.round((libres / total) * 100);
    }

    const data = {
      comp_total: compTotal[0].c,
      comp_libres: compLibres[0].c,
      p_compus: porcentaje(compLibres[0].c, compTotal[0].c),
      cel_total: celTotal[0].c,
      cel_libres: celLibres[0].c,
      p_cel: porcentaje(celLibres[0].c, celTotal[0].c),
      sim_total: simTotal[0].c,
      sim_libres: simLibres[0].c,
      p_sim: porcentaje(simLibres[0].c, simTotal[0].c)
    };

    res.render("home", { title: "Dashboard IT", data });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("Error en /home:", err);
    req.flash("error", "No se pudo cargar el dashboard.");
    res.redirect("/login");
  }
});

// Listado de personal con equipos (equivalente a lista_personal)
router.get("/personal", ensureAuthenticated, async (req, res) => {
  const q = (req.query.q || "").trim();
  try {
    let empleados;
    const params = [];
    let where = "";

    if (q) {
      where =
        "WHERE nombre LIKE ? OR apellidos LIKE ? OR ticket LIKE ?";
      const like = `%${q}%`;
      params.push(like, like, like);
    }

    empleados = await query(
      `SELECT * FROM equipos_empleado ${where} ORDER BY apellidos, nombre`,
      params
    );

    const [computadoras, celulares, simcards] = await Promise.all([
      query("SELECT * FROM equipos_computadora"),
      query("SELECT * FROM equipos_celular"),
      query("SELECT * FROM equipos_simcard")
    ]);

    // Agrupamos equipos por empleado
    const porEmpleado = {};
    empleados.forEach((e) => {
      porEmpleado[e.id] = {
        empleado: e,
        computadoras: [],
        celulares: [],
        simcards: []
      };
    });

    computadoras.forEach((c) => {
      if (c.asignado_a_id && porEmpleado[c.asignado_a_id]) {
        porEmpleado[c.asignado_a_id].computadoras.push(c);
      }
    });
    celulares.forEach((c) => {
      if (c.asignado_a_id && porEmpleado[c.asignado_a_id]) {
        porEmpleado[c.asignado_a_id].celulares.push(c);
      }
    });
    simcards.forEach((s) => {
      if (s.asignado_a_id && porEmpleado[s.asignado_a_id]) {
        porEmpleado[s.asignado_a_id].simcards.push(s);
      }
    });

    const items = Object.values(porEmpleado);

    res.render("lista_personal", {
      title: "Listado de Personal",
      items,
      q
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("Error en /personal:", err);
    req.flash("error", "No se pudo cargar el listado de personal.");
    res.redirect("/home");
  }
});

// Editar colaborador
router.get("/personal/:id/editar", ensureAuthenticated, ensureStaff, async (req, res) => {
  const { id } = req.params;
  try {
    const rows = await query("SELECT * FROM equipos_empleado WHERE id = ?", [id]);
    if (!rows.length) {
      req.flash("error", "Colaborador no encontrado.");
      return res.redirect("/personal");
    }
    const empleado = rows[0];
    return res.render("editar_colaborador", {
      empleado,
      fieldErrors: {},
      old: empleado
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("Error en GET /personal/:id/editar:", err);
    req.flash("error", "No se pudo cargar el formulario.");
    return res.redirect("/personal");
  }
});

router.post(
  "/personal/:id/editar",
  ensureAuthenticated,
  ensureStaff,
  empleadoRules,
  async (req, res) => {
    const { id } = req.params;
    const errors = getErrors(req);
    if (errors.length) {
      const rows = await query("SELECT * FROM equipos_empleado WHERE id = ?", [id]);
      const empleado = rows[0] || {};
      return res.render("editar_colaborador", {
        empleado: { id, ...empleado },
        fieldErrors: getFieldErrors(req),
        old: req.body
      });
    }

    const { nombre, apellidos, correo, puesto, ticket } = req.body;
    try {
      const existentes = await query(
        "SELECT id FROM equipos_empleado WHERE correo = ? AND id != ? LIMIT 1",
        [correo, id]
      );
      if (existentes.length) {
        const rows = await query("SELECT * FROM equipos_empleado WHERE id = ?", [id]);
        return res.render("editar_colaborador", {
          empleado: rows[0] || { id },
          fieldErrors: { correo: ["Ya existe otro colaborador con ese correo."] },
          old: req.body
        });
      }

      await query(
        "UPDATE equipos_empleado SET nombre = ?, apellidos = ?, correo = ?, puesto = ?, ticket = ? WHERE id = ?",
        [nombre, apellidos, correo, puesto, ticket, id]
      );
      req.flash("success", "Colaborador actualizado correctamente.");
      return res.redirect("/personal");
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("Error en POST /personal/:id/editar:", err);
      req.flash("error", "No se pudo actualizar el colaborador.");
      return res.redirect("/personal");
    }
  }
);

// Eliminar colaborador (desasigna todos los equipos y borra al empleado)
router.post("/personal/:id/eliminar", ensureAuthenticated, ensureStaff, async (req, res) => {
  const { id } = req.params;
  try {
    await Promise.all([
      query("UPDATE equipos_computadora SET asignado_a_id = NULL, estado = 'Usado', fecha_asignacion = NULL WHERE asignado_a_id = ?", [id]),
      query("UPDATE equipos_celular SET asignado_a_id = NULL, fecha_asignacion = NULL WHERE asignado_a_id = ?", [id]),
      query("UPDATE equipos_simcard SET asignado_a_id = NULL, fecha_asignacion = NULL WHERE asignado_a_id = ?", [id])
    ]);
    await query("DELETE FROM equipos_empleado WHERE id = ?", [id]);
    req.flash("success", "Colaborador eliminado y equipos liberados.");
    return res.redirect("/personal");
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("Error en POST /personal/:id/eliminar:", err);
    req.flash("error", "No se pudo eliminar el colaborador.");
    return res.redirect("/personal");
  }
});

// Inventario detallado por tipo
router.get("/inventario/:tipo", ensureAuthenticated, async (req, res) => {
  const { tipo } = req.params;
  const config = {
    computadora: {
      tabla: "equipos_computadora",
      titulo: "Inventario de Computadoras"
    },
    celular: {
      tabla: "equipos_celular",
      titulo: "Inventario de Celulares"
    },
    sim: {
      tabla: "equipos_simcard",
      titulo: "Inventario de SIM Cards"
    }
  }[tipo];

  if (!config) {
    return res.redirect("/home");
  }

  try {
    const objetos = await query(`SELECT * FROM ${config.tabla}`);
    const empleados = await query("SELECT id, nombre, apellidos, ticket FROM equipos_empleado");

    const empleadosPorId = {};
    empleados.forEach((e) => {
      empleadosPorId[e.id] = e;
    });

    res.render("inventario_detalle", {
      title: config.titulo,
      objetos,
      tipo,
      empleadosPorId
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("Error en /inventario/:tipo:", err);
    req.flash("error", "No se pudo cargar el inventario.");
    res.redirect("/home");
  }
});

const inventarioConfig = {
  computadora: { tabla: "equipos_computadora", titulo: "Editar computadora", rules: computadoraRules },
  celular: { tabla: "equipos_celular", titulo: "Editar celular", rules: celularRules },
  sim: { tabla: "equipos_simcard", titulo: "Editar SIM Card", rules: simRules }
};

// Editar equipo (computadora / celular / sim)
router.get("/inventario/:tipo/:id/editar", ensureAuthenticated, ensureStaff, async (req, res) => {
  const { tipo, id } = req.params;
  const config = inventarioConfig[tipo];
  if (!config) return res.redirect("/home");
  try {
    const rows = await query(`SELECT * FROM ${config.tabla} WHERE id = ?`, [id]);
    if (!rows.length) {
      req.flash("error", "Registro no encontrado.");
      return res.redirect(`/inventario/${tipo}`);
    }
    return res.render("editar_equipo", {
      tipo,
      titulo: config.titulo,
      item: rows[0],
      fieldErrors: {},
      old: rows[0]
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("Error en GET /inventario/:tipo/:id/editar:", err);
    req.flash("error", "No se pudo cargar el formulario.");
    return res.redirect("/home");
  }
});

router.post(
  "/inventario/:tipo/:id/editar",
  ensureAuthenticated,
  ensureStaff,
  async (req, res) => {
    const { tipo, id } = req.params;
    const config = inventarioConfig[tipo];
    if (!config) return res.redirect("/home");

    const rules = config.rules;
    if (rules) await Promise.all(rules.map((r) => r.run(req)));
    const errors = getErrors(req);
    if (errors.length) {
      const rows = await query(`SELECT * FROM ${config.tabla} WHERE id = ?`, [id]);
      return res.render("editar_equipo", {
        tipo,
        titulo: config.titulo,
        item: rows[0] || {},
        fieldErrors: getFieldErrors(req),
        old: req.body
      });
    }

    try {
      if (tipo === "computadora") {
        const { marca, modelo, serie, estado } = req.body;
        await query(
          "UPDATE equipos_computadora SET marca = ?, modelo = ?, serie = ?, estado = ? WHERE id = ?",
          [marca, modelo, serie, estado || "Nuevo", id]
        );
      } else if (tipo === "celular") {
        const { marca, modelo, serie, imei } = req.body;
        await query(
          "UPDATE equipos_celular SET marca = ?, modelo = ?, serie = ?, imei = ? WHERE id = ?",
          [marca, modelo, serie, imei || null, id]
        );
      } else if (tipo === "sim") {
        const { numero_celular, icc, imei } = req.body;
        await query(
          "UPDATE equipos_simcard SET numero_celular = ?, icc = ?, imei = ? WHERE id = ?",
          [numero_celular, icc, imei, id]
        );
      }
      req.flash("success", "Equipo actualizado correctamente.");
      return res.redirect(`/inventario/${tipo}`);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("Error en POST /inventario/:tipo/:id/editar:", err);
      const isUnique = err.message && (err.message.includes("UNIQUE") || err.code === "SQLITE_CONSTRAINT_UNIQUE");
      req.flash("error", isUnique ? "Ya existe un equipo con esa serie, ICC o IMEI." : "No se pudo actualizar el equipo.");
      const rows = await query(`SELECT * FROM ${config.tabla} WHERE id = ?`, [id]);
      return res.render("editar_equipo", {
        tipo,
        titulo: config.titulo,
        item: rows[0] || {},
        fieldErrors: getFieldErrors(req),
        old: req.body
      });
    }
  }
);

// Eliminar equipo
router.post("/inventario/:tipo/:id/eliminar", ensureAuthenticated, ensureStaff, async (req, res) => {
  const { tipo, id } = req.params;
  const config = inventarioConfig[tipo];
  if (!config) return res.redirect("/home");
  try {
    await query(`DELETE FROM ${config.tabla} WHERE id = ?`, [id]);
    req.flash("success", "Equipo eliminado del inventario.");
    return res.redirect(`/inventario/${tipo}`);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("Error en POST /inventario/:tipo/:id/eliminar:", err);
    req.flash("error", "No se pudo eliminar el equipo.");
    return res.redirect(`/inventario/${tipo}`);
  }
});

// Asignar equipo (equivalente a asignar_equipo)
router.get("/asignar", ensureAuthenticated, ensureStaff, async (req, res) => {
  try {
    const [computadoras, celulares, simcards] = await Promise.all([
      query(
        "SELECT id, marca, modelo, serie FROM equipos_computadora WHERE asignado_a_id IS NULL ORDER BY marca, modelo"
      ),
      query(
        "SELECT id, marca, modelo, serie FROM equipos_celular WHERE asignado_a_id IS NULL ORDER BY marca, modelo"
      ),
      query(
        "SELECT id, numero_celular, icc, imei, tipo FROM equipos_simcard WHERE asignado_a_id IS NULL ORDER BY numero_celular"
      )
    ]);

    res.render("asignacion", {
      computadoras,
      celulares,
      simcards,
      fieldErrors: {},
      old: {}
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("Error en GET /asignar:", err);
    req.flash("error", "No se pudo cargar el formulario de asignación.");
    res.redirect("/home");
  }
});

router.post(
  "/asignar",
  ensureAuthenticated,
  ensureStaff,
  asignacionRules,
  async (req, res) => {
    const errors = getErrors(req);
    if (errors.length) {
      const [computadoras, celulares, simcards] = await Promise.all([
        query(
          "SELECT id, marca, modelo, serie FROM equipos_computadora WHERE asignado_a_id IS NULL ORDER BY marca, modelo"
        ),
        query(
          "SELECT id, marca, modelo, serie FROM equipos_celular WHERE asignado_a_id IS NULL ORDER BY marca, modelo"
        ),
        query(
          "SELECT id, numero_celular, icc, imei, tipo FROM equipos_simcard WHERE asignado_a_id IS NULL ORDER BY numero_celular"
        )
      ]);
      return res.render("asignacion", {
        computadoras,
        celulares,
        simcards,
        fieldErrors: getFieldErrors(req),
        old: req.body
      });
    }

    const {
      nombre,
      apellidos,
      correo,
      puesto,
      ticket,
      computadora_id: computadoraId,
      celular_id: celularId,
      sim_id: simId
    } = req.body;

    try {
      const empleadoResult = await query(
        "INSERT INTO equipos_empleado (nombre, apellidos, correo, puesto, ticket) VALUES (?, ?, ?, ?, ?)",
        [nombre, apellidos, correo, puesto, ticket]
      );

      const empleadoId = empleadoResult.insertId;

      // Asignar equipos seleccionados
      const updates = [];
      if (computadoraId) {
        updates.push(
          query(
            "UPDATE equipos_computadora SET asignado_a_id = ?, fecha_asignacion = NOW(), estado = 'Usado' WHERE id = ?",
            [empleadoId, computadoraId]
          )
        );
      }
      if (celularId) {
        updates.push(
          query(
            "UPDATE equipos_celular SET asignado_a_id = ?, fecha_asignacion = NOW() WHERE id = ?",
            [empleadoId, celularId]
          )
        );
      }
      if (simId) {
        updates.push(
          query(
            "UPDATE equipos_simcard SET asignado_a_id = ?, fecha_asignacion = NOW() WHERE id = ?",
            [empleadoId, simId]
          )
        );
      }

      if (updates.length) {
        await Promise.all(updates);
      }

      req.flash("success", "Asignación registrada correctamente.");
      return res.redirect("/home");
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("Error en POST /asignar:", err);
      req.flash("error", err.code === "SQLITE_CONSTRAINT_UNIQUE" ? "El correo del colaborador ya está registrado." : "Ocurrió un error al registrar la asignación.");
      return res.redirect("/asignar");
    }
  });

// Registrar equipo (equivalente a registrar_equipo)
router.get(
  "/registrar/:tipo",
  ensureAuthenticated,
  ensureStaff,
  async (req, res) => {
    const { tipo } = req.params;
    const config = {
      computadora: "Registrar Computadora",
      celular: "Registrar Celular",
      sim: "Registrar SIM Card"
    };

    if (!config[tipo]) {
      return res.redirect("/home");
    }

    return res.render("registrar_equipo", {
      tipo,
      titulo: config[tipo],
      fieldErrors: {},
      old: {}
    });
  }
);

const registrarRulesByTipo = {
  computadora: computadoraRules,
  celular: celularRules,
  sim: simRules
};

router.post(
  "/registrar/:tipo",
  ensureAuthenticated,
  ensureStaff,
  maybeUploadEsimQr,
  async (req, res) => {
    const { tipo } = req.params;
    const config = {
      computadora: "Registrar Computadora",
      celular: "Registrar Celular",
      sim: "Registrar SIM Card"
    };

    if (!config[tipo]) return res.redirect("/home");

    const rules = registrarRulesByTipo[tipo];
    if (rules) {
      await Promise.all(rules.map((r) => r.run(req)));
    }

    const errors = getErrors(req);
    if (errors.length) {
      return res.render("registrar_equipo", {
        tipo,
        titulo: config[tipo],
        fieldErrors: getFieldErrors(req),
        old: req.body
      });
    }

    try {
      if (tipo === "computadora") {
        const { marca, modelo, serie, estado } = req.body;
        await query(
          "INSERT INTO equipos_computadora (marca, modelo, serie, estado) VALUES (?, ?, ?, ?)",
          [marca, modelo, serie, estado || "Nuevo"]
        );
      } else if (tipo === "celular") {
        const { marca, modelo, serie, imei } = req.body;
        await query(
          "INSERT INTO equipos_celular (marca, modelo, serie, imei) VALUES (?, ?, ?, ?)",
          [marca, modelo, serie, imei || null]
        );
      } else if (tipo === "sim") {
        const { tipo_sim, numero_celular, icc, imei, reemplazo_sim } = req.body;
        const tipoLinea = tipo_sim === "ESIM" ? "ESIM" : "SIM";
        const esReemplazo = reemplazo_sim === "si" ? 1 : 0;
        const qrPath =
          tipoLinea === "ESIM" && req.file
            ? `/uploads/esim/${req.file.filename}`
            : null;
        await query(
          "INSERT INTO equipos_simcard (numero_celular, icc, imei, tipo, es_reemplazo, qr_esim) VALUES (?, ?, ?, ?, ?, ?)",
          [numero_celular, icc, imei, tipoLinea, esReemplazo, qrPath]
        );
      } else {
        return res.redirect("/home");
      }

      req.flash("success", "Equipo registrado en inventario.");
      return res.redirect("/home");
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("Error en POST /registrar/:tipo:", err);
      const isUnique =
        err.message && (err.message.includes("UNIQUE") || err.code === "SQLITE_CONSTRAINT_UNIQUE");
      req.flash(
        "error",
        isUnique
          ? "Ya existe un equipo con esa serie, ICC o IMEI. Verifica los datos."
          : "Ocurrió un error al registrar el equipo."
      );
      return res.render("registrar_equipo", {
        tipo,
        titulo: config[tipo],
        fieldErrors: {},
        old: req.body
      });
    }
  }
);

// Desvincular equipo individual (equivalente a desvincular_equipo)
router.post(
  "/desvincular/:tipo/:equipoId",
  ensureAuthenticated,
  ensureStaff,
  async (req, res) => {
    const { tipo, equipoId } = req.params;

    const tablas = {
      computadora: "equipos_computadora",
      celular: "equipos_celular",
      sim: "equipos_simcard"
    };

    const tabla = tablas[tipo];
    if (!tabla) {
      return res.redirect("/personal");
    }

    try {
      if (tipo === "computadora") {
        await query(
          `UPDATE ${tabla} SET asignado_a_id = NULL, fecha_asignacion = NULL, estado = 'Usado' WHERE id = ?`,
          [equipoId]
        );
      } else {
        await query(
          `UPDATE ${tabla} SET asignado_a_id = NULL, fecha_asignacion = NULL WHERE id = ?`,
          [equipoId]
        );
      }

      req.flash("success", "Equipo desvinculado correctamente.");
      return res.redirect("/personal");
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("Error en POST /desvincular:", err);
      req.flash("error", "No se pudo desvincular el equipo.");
      return res.redirect("/personal");
    }
  }
);

// Liberar todos los equipos de un empleado y eliminarlo (equivalente a liberar_equipos)
router.post(
  "/liberar/:empleadoId",
  ensureAuthenticated,
  ensureSuperuser,
  async (req, res) => {
    const { empleadoId } = req.params;

    try {
      await Promise.all([
        query(
          "UPDATE equipos_computadora SET asignado_a_id = NULL, estado = 'Usado', fecha_asignacion = NULL WHERE asignado_a_id = ?",
          [empleadoId]
        ),
        query(
          "UPDATE equipos_celular SET asignado_a_id = NULL, fecha_asignacion = NULL WHERE asignado_a_id = ?",
          [empleadoId]
        ),
        query(
          "UPDATE equipos_simcard SET asignado_a_id = NULL, fecha_asignacion = NULL WHERE asignado_a_id = ?",
          [empleadoId]
        )
      ]);

      await query("DELETE FROM equipos_empleado WHERE id = ?", [empleadoId]);

      req.flash("success", "Colaborador dado de baja y equipos liberados.");
      return res.redirect("/personal");
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("Error en POST /liberar:", err);
      req.flash("error", "No se pudo liberar los equipos del colaborador.");
      return res.redirect("/personal");
    }
  }
);

// Registrar nuevo admin (equivalente a registrar_admin)
router.get(
  "/registrar-admin",
  ensureAuthenticated,
  ensureSuperuser,
  (req, res) => {
    res.render("registro_admin", { fieldErrors: {}, old: {} });
  }
);

router.post(
  "/registrar-admin",
  ensureAuthenticated,
  ensureSuperuser,
  registroAdminRules,
  async (req, res) => {
    const errors = getErrors(req);
    if (errors.length) {
      return res.render("registro_admin", {
        fieldErrors: getFieldErrors(req),
        old: req.body
      });
    }

    const { username, email, first_name, password1 } = req.body;

    try {
      const existentes = await query(
        "SELECT id FROM auth_user WHERE username = ? OR email = ? LIMIT 1",
        [username, email]
      );
      if (existentes.length) {
        req.flash(
          "error",
          "Ya existe un usuario con ese nombre de usuario o correo."
        );
        return res.redirect("/registrar-admin");
      }

      const passwordHash = makeDjangoPassword(password1);

      await query(
        "INSERT INTO auth_user (password, is_superuser, username, first_name, last_name, email, is_staff, is_active, date_joined) VALUES (?, 0, ?, ?, '', ?, 1, 1, NOW())",
        [passwordHash, username, first_name, email]
      );

      req.flash("success", `Usuario '${username}' creado con éxito.`);
      return res.redirect("/home");
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("Error en POST /registrar-admin:", err);
      req.flash("error", "No se pudo registrar el usuario administrador.");
      return res.render("registro_admin", {
        fieldErrors: {},
        old: req.body
      });
    }
  }
);

// ---------- Documentos Word (plantillas .docx) ----------
// Generar documento para un colaborador (datos + equipos asignados). Query: ?plantilla=FormatoComputo.docx
router.get(
  "/documento/empleado/:id",
  ensureAuthenticated,
  ensureStaff,
  async (req, res) => {
    const { id } = req.params;

    try {
      const empleados = await query("SELECT * FROM equipos_empleado WHERE id = ?", [id]);
      if (!empleados.length) {
        req.flash("error", "Colaborador no encontrado.");
        return res.redirect("/personal");
      }
      const empleado = empleados[0];

      const [computadoras, celulares, simcards] = await Promise.all([
        query(
          "SELECT marca, modelo, serie, estado, fecha_asignacion FROM equipos_computadora WHERE asignado_a_id = ?",
          [id]
        ),
        query(
          "SELECT marca, modelo, serie, imei, fecha_asignacion FROM equipos_celular WHERE asignado_a_id = ?",
          [id]
        ),
        query(
          "SELECT numero_celular, icc, imei, tipo, es_reemplazo, qr_esim, fecha_asignacion FROM equipos_simcard WHERE asignado_a_id = ?",
          [id]
        )
      ]);

      const fecha = new Date().toLocaleDateString("es-MX", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric"
      });

      const nombreCompleto = `${empleado.nombre} ${empleado.apellidos}`.trim();
      const primeraComputadora = computadoras[0] || {};
      const primerCelular = celulares[0] || {};
      const primeraSim = simcards[0] || {};

      const estadoNormalizado =
        typeof primeraComputadora.estado === "string"
          ? primeraComputadora.estado.toLowerCase()
          : "";

      const formatearFechaHora = (valor) => {
        if (!valor) return "";
        const d = new Date(valor);
        if (Number.isNaN(d.getTime())) return "";
        return d.toLocaleString("es-MX", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit"
        });
      };

      const fechaAsignacionEquipo = formatearFechaHora(
        primeraComputadora.fecha_asignacion ||
        primerCelular.fecha_asignacion ||
        primeraSim.fecha_asignacion
      );

      const tieneEsim = simcards.some((s) => s.tipo === "ESIM");

      // Ruta absoluta de la imagen de QR (si existe) para PDF.
      let qrEsimAbs = null;
      if (primeraSim.qr_esim) {
        const relQr = primeraSim.qr_esim.startsWith("/")
          ? primeraSim.qr_esim.slice(1)
          : primeraSim.qr_esim;
        qrEsimAbs = path.join(__dirname, "..", "..", "public", relQr);
      }

      const data = {
        nombre: empleado.nombre,
        apellidos: empleado.apellidos,
        nombre_completo: nombreCompleto,
        user: nombreCompleto,
        correo: empleado.correo,
        puesto: empleado.puesto,
        area: empleado.puesto,
        ticket: empleado.ticket,
        fecha,
        computadoras,
        celulares: celulares.map((c) => ({ ...c, imei: c.imei || c.serie })),
        simcards,
        // Fecha y hora de asignación del equipo (computadora / celular / SIM).
        fecha_asignacion: fechaAsignacionEquipo,
        // Primer equipo (por si el formato solo tiene un bloque).
        // Si no hay computadora, usa los datos del primer celular.
        marca: primeraComputadora.marca || primerCelular.marca || "",
        modelo: primeraComputadora.modelo || primerCelular.modelo || "",
        serie: primeraComputadora.serie || primerCelular.serie || "",
        modelo_serie: (() => {
          const modeloBase = primeraComputadora.modelo || primerCelular.modelo || "";
          const serieBase = primeraComputadora.serie || primerCelular.serie || "";
          if (!modeloBase && !serieBase) {
            return "";
          }
          return `${modeloBase}${serieBase ? ` (${serieBase})` : ""}`;
        })(),
        // Si no tenemos estado en BD (por ejemplo, solo hay celular), asumimos "nuevo" para no dejar vacío.
        estado_equipo: estadoNormalizado || "nuevo",
        // Datos específicos de SIM/eSIM (si existe): MSISDN, ICC, IMSI, reemplazo y QR.
        numero_celular: primeraSim.numero_celular || "",
        icc: primeraSim.icc || "",
        msisdn: primeraSim.numero_celular || "",
        imsi: primeraSim.imei || "",
        reemplazo_sim: primeraSim.es_reemplazo ? "Sí" : "No",
        qr_esim: primeraSim.qr_esim || "",
        qr_esim_abs: qrEsimAbs,
        // IMEI: prioridad al celular asignado; si no, SIM; si no, serie del celular como identificador.
        imei: primerCelular.imei || simcards[0]?.imei || primerCelular.serie || ""
      };

      // Si hay eSIM, generamos PDF en lugar de Word.
      if (tieneEsim && !req.query.plantilla) {
        const pdfBuffer = await generateEsimPdf(data);
        const nombrePdf = `Formato_ESIM_${empleado.nombre}_${empleado.apellidos}_${id}.pdf`.replace(
          /\s+/g,
          "_"
        );
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `attachment; filename="${nombrePdf}"`);
        return res.end(pdfBuffer);
      }

      // Detectar plantilla Word según el equipo asignado:
      // - Si no hay eSIM pero hay computadora → formato de cómputo
      // - Si no hay eSIM ni computadora pero hay celular → formato de celulares
      // - Si solo hay SIM física → formato eSIM (mismo formato de línea móvil)
      let plantilla = req.query.plantilla;
      if (!plantilla) {
        const tieneEsim = simcards.some((s) => s.tipo === "ESIM");

        if (tieneEsim) {
          plantilla = "Formato_ESIM.docx";
        } else if (computadoras.length) {
          plantilla = "FormatoComputo-.docx";
        } else if (celulares.length) {
          plantilla = "FormatoCelular-.docx";
        } else if (simcards.length) {
          plantilla = "Formato_ESIM.docx";
        } else {
          plantilla = "FormatoComputo-.docx";
        }
      }

      const buffer = generateDocx(plantilla, data);
      const nombreArchivo = `Formato_${empleado.nombre}_${empleado.apellidos}_${id}.docx`.replace(/\s+/g, "_");

      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
      res.setHeader("Content-Disposition", `attachment; filename="${nombreArchivo}"`);
      res.end(buffer);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("Error generando documento:", err);
      if (err.message && err.message.includes("Plantilla no encontrada")) {
        req.flash("error", "No hay plantilla Word. Coloca un .docx en templates/documentos (ej: FormatoComputo.docx).");
      } else {
        req.flash("error", "No se pudo generar el documento.");
      }
      return res.redirect("/personal");
    }
  }
);

// Listar plantillas disponibles (útil para la UI)
router.get("/documento/plantillas", ensureAuthenticated, (req, res) => {
  const plantillas = listTemplates();
  res.json({ plantillas });
});

module.exports = router;

