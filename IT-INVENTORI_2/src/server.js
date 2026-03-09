const express = require("express");
const path = require("path");
const session = require("express-session");
const flash = require("connect-flash");
const methodOverride = require("method-override");
const { poolConfig, isSqlite } = require("./utils/db");

require("dotenv").config();

const app = express();

// Configuración de vistas (usaremos EJS)
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// Archivos estáticos (CSS, etc.)
app.use(express.static(path.join(__dirname, "..", "public")));

// Middlewares básicos
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(methodOverride("_method"));

// Sesiones: SQLite (memoria) o MySQL
let sessionStore;
if (isSqlite) {
  sessionStore = undefined; // Store en memoria por defecto
} else {
  const MySQLStore = require("express-mysql-session")(session);
  sessionStore = new MySQLStore({
    ...poolConfig,
    createDatabaseTable: true
  });
}

app.use(
  session({
    key: process.env.SESSION_NAME || "it_inventori_sid",
    secret: process.env.SESSION_SECRET || "cambia_este_secret_en_produccion",
    resave: false,
    saveUninitialized: false,
    store: sessionStore,
    cookie: {
      maxAge: 1000 * 60 * 60 * 4 // 4 horas
    }
  })
);

app.use(flash());

// Variables globales para las vistas
app.use((req, res, next) => {
  res.locals.currentUser = req.session.user || null;
  res.locals.messages = {
    success: req.flash("success"),
    error: req.flash("error")
  };
  next();
});

// Rutas
const authRoutes = require("./routes/auth");
const mainRoutes = require("./routes/main");

app.use("/", authRoutes);
app.use("/", mainRoutes);

// Página 404 sencilla
app.use((req, res) => {
  res.status(404).render("404", { title: "Página no encontrada" });
});

const PORT = process.env.PORT || 3000;

function iniciarServidor(puerto) {
  const servidor = app.listen(puerto, () => {
    // eslint-disable-next-line no-console
    console.log(`Servidor escuchando en http://localhost:${puerto}`);
  });
  servidor.on("error", (err) => {
    if (err.code === "EADDRINUSE") {
      // eslint-disable-next-line no-console
      console.log(`Puerto ${puerto} en uso, intentando ${puerto + 1}...`);
      iniciarServidor(puerto + 1);
    } else {
      throw err;
    }
  });
}

iniciarServidor(Number(PORT));

