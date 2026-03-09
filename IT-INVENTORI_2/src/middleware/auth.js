function ensureAuthenticated(req, res, next) {
  if (req.session && req.session.user) {
    return next();
  }
  req.flash("error", "Debes iniciar sesión para acceder a esta página.");
  return res.redirect("/login");
}

function ensureStaff(req, res, next) {
  if (req.session && req.session.user && req.session.user.is_staff) {
    return next();
  }
  req.flash("error", "No tienes permisos para realizar esta acción.");
  return res.redirect("/home");
}

function ensureSuperuser(req, res, next) {
  if (req.session && req.session.user && req.session.user.is_superuser) {
    return next();
  }
  req.flash("error", "Solo un superusuario puede realizar esta acción.");
  return res.redirect("/home");
}

module.exports = {
  ensureAuthenticated,
  ensureStaff,
  ensureSuperuser
};

