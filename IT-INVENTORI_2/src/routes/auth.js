const express = require("express");
const { query } = require("../utils/db");
const { checkDjangoPassword } = require("../utils/djangoPassword");
const { getErrors, getFieldErrors, loginRules } = require("../validators");

const router = express.Router();

// Mostrar formulario de login
router.get("/login", (req, res) => {
  if (req.session.user) {
    return res.redirect("/home");
  }
  return res.render("auth/login", {
    title: "Iniciar sesión",
    fieldErrors: {},
    old: {}
  });
});

// Procesar login
router.post("/login", loginRules, async (req, res) => {
  const errors = getErrors(req);
  if (errors.length) {
    return res.render("auth/login", {
      title: "Iniciar sesión",
      fieldErrors: getFieldErrors(req),
      old: req.body
    });
  }

  const { username, password } = req.body;

  try {
    const users = await query(
      "SELECT id, username, email, password, is_staff, is_superuser FROM auth_user WHERE username = ? OR email = ? LIMIT 1",
      [username, username]
    );

    if (!users || !users.length) {
      req.flash("error", "Credenciales inválidas.");
      return res.redirect("/login");
    }

    const user = users[0];
    const storedPassword = user.password != null ? String(user.password) : "";
    const valid = checkDjangoPassword(password, storedPassword);

    if (!valid) {
      req.flash("error", "Credenciales inválidas.");
      return res.redirect("/login");
    }

    req.session.user = {
      id: user.id,
      username: user.username,
      email: user.email,
      is_staff: !!user.is_staff,
      is_superuser: !!user.is_superuser
    };

    req.flash("success", "Has iniciado sesión correctamente.");
    return res.redirect("/home");
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("Error en login:", err.message || err);
    const msg =
      err.message && err.message.includes("no such table")
        ? "Base de datos sin configurar. Reinicia el servidor."
        : "Ocurrió un error al iniciar sesión.";
    req.flash("error", msg);
    return res.redirect("/login");
  }
});

// Logout
router.post("/logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect("/login");
  });
});

module.exports = router;

