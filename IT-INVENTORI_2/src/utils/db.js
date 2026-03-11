require("dotenv").config();

const path = require("path");
const fs = require("fs");

const DB_TYPE = process.env.DB_TYPE || "sqlite";

let pool = null;
let poolConfig = null;
let sqliteDb = null;
let sqliteReady = null;

if (DB_TYPE === "sqlite") {
  const dbPath =
    process.env.DB_PATH ||
    path.join(__dirname, "..", "..", "..", "db.sqlite3");

  sqliteReady = require("sql.js")()
    .then((SQL) => {
      const buf = fs.existsSync(dbPath) ? fs.readFileSync(dbPath) : null;
      sqliteDb = new SQL.Database(buf || undefined);
      initSchema();
      return sqliteDb;
    });

  function initSchema() {
    const schemas = [
      `CREATE TABLE IF NOT EXISTS auth_user (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        password VARCHAR(128) NOT NULL,
        last_login DATETIME NULL,
        is_superuser SMALLINT NOT NULL DEFAULT 0,
        username VARCHAR(150) NOT NULL UNIQUE,
        last_name VARCHAR(150) NOT NULL DEFAULT '',
        email VARCHAR(254) NOT NULL,
        is_staff SMALLINT NOT NULL DEFAULT 0,
        is_active SMALLINT NOT NULL DEFAULT 1,
        date_joined DATETIME NOT NULL,
        first_name VARCHAR(150) NOT NULL DEFAULT ''
      )`,
      `CREATE TABLE IF NOT EXISTS equipos_empleado (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nombre VARCHAR(100) NOT NULL,
        apellidos VARCHAR(100) NOT NULL,
        correo VARCHAR(254) NOT NULL UNIQUE,
        puesto VARCHAR(100) NOT NULL,
        ticket VARCHAR(10) NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS equipos_computadora (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        marca VARCHAR(50) NOT NULL,
        modelo VARCHAR(50) NOT NULL,
        serie VARCHAR(100) NOT NULL UNIQUE,
        estado VARCHAR(10) NOT NULL DEFAULT 'Nuevo',
        fecha_asignacion DATETIME NULL,
        asignado_a_id INTEGER NULL REFERENCES equipos_empleado(id)
      )`,
      `CREATE TABLE IF NOT EXISTS equipos_celular (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        marca VARCHAR(50) NOT NULL,
        modelo VARCHAR(50) NOT NULL,
        serie VARCHAR(100) NOT NULL UNIQUE,
        imei VARCHAR(20) NULL,
        fecha_asignacion DATETIME NULL,
        asignado_a_id INTEGER NULL REFERENCES equipos_empleado(id)
      )`,
      `CREATE TABLE IF NOT EXISTS equipos_simcard (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        numero_celular VARCHAR(15) NOT NULL,
        icc VARCHAR(25) NOT NULL UNIQUE,
        imei VARCHAR(20) NOT NULL UNIQUE,
        tipo VARCHAR(10) NOT NULL DEFAULT 'SIM',
        es_reemplazo SMALLINT NOT NULL DEFAULT 0,
        qr_esim VARCHAR(255) NULL,
        fecha_asignacion DATETIME NULL,
        asignado_a_id INTEGER NULL REFERENCES equipos_empleado(id)
      )`
    ];
    for (const s of schemas) sqliteDb.run(s);

    // Intentar añadir columnas nuevas a tablas existentes (si ya se creó antes) sin fallar si ya existen.
    try {
      sqliteDb.run("ALTER TABLE equipos_simcard ADD COLUMN tipo VARCHAR(10) NOT NULL DEFAULT 'SIM'");
    } catch (e) {
      // columna ya existe
    }
    try {
      sqliteDb.run("ALTER TABLE equipos_simcard ADD COLUMN es_reemplazo SMALLINT NOT NULL DEFAULT 0");
    } catch (e) {
      // columna ya existe
    }
    try {
      sqliteDb.run("ALTER TABLE equipos_simcard ADD COLUMN qr_esim VARCHAR(255) NULL");
    } catch (e) {
      // columna ya existe
    }
    if (dbPath && fs.existsSync(path.dirname(dbPath))) {
      fs.writeFileSync(dbPath, Buffer.from(sqliteDb.export()));
    }
  }

  async function query(sql, params = []) {
    await sqliteReady;
    const isSelect = sql.trim().toUpperCase().startsWith("SELECT");
    const sqlForSqlite = sql.replace(/NOW\(\)/gi, "datetime('now','localtime')");
    const flatParams = Array.isArray(params) ? params : [params];

    if (isSelect) {
      const stmt = sqliteDb.prepare(sqlForSqlite);
      stmt.bind(flatParams);
      const rows = [];
      while (stmt.step()) rows.push(stmt.getAsObject());
      stmt.free();
      return rows;
    }

    sqliteDb.run(sqlForSqlite, flatParams);
    const r = sqliteDb.exec("SELECT last_insert_rowid() AS id");
    const insertId = (r[0] && r[0].values[0]) ? r[0].values[0][0] : 0;
    if (dbPath && fs.existsSync(path.dirname(dbPath))) {
      fs.writeFileSync(dbPath, Buffer.from(sqliteDb.export()));
    }
    return { insertId };
  }

  module.exports = {
    pool: null,
    poolConfig: null,
    query,
    isSqlite: true,
    init: () => sqliteReady
  };
} else {
  const mysql = require("mysql2/promise");

  poolConfig = {
    host: process.env.DB_HOST || "127.0.0.1",
    port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 8889,
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "root",
    database: process.env.DB_NAME || "inventario_it",
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
  };

  pool = mysql.createPool(poolConfig);

  async function query(sql, params = []) {
    const [rows] = await pool.execute(sql, params);
    return rows;
  }

  module.exports = {
    pool,
    poolConfig,
    query,
    isSqlite: false,
    init: () => Promise.resolve()
  };
}
