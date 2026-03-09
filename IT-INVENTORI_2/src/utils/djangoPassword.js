const crypto = require("crypto");

function pbkdf2Sha256(password, salt, iterations, keyLength = 32) {
  return crypto
    .pbkdf2Sync(password, salt, iterations, keyLength, "sha256")
    .toString("base64");
}

// Valida una contraseña contra un hash de Django (pbkdf2_sha256$iter$salt$hash)
function checkDjangoPassword(password, encoded) {
  try {
    if (!password || !encoded) return false;
    const parts = String(encoded).trim().split("$");
    if (parts.length !== 4) return false;

    const [algorithm, iterStr, salt, hashPart] = parts;
    if (algorithm !== "pbkdf2_sha256") return false;

    const iterations = parseInt(iterStr, 10);
    if (!Number.isFinite(iterations) || iterations <= 0) return false;

    const calculated = pbkdf2Sha256(password, salt, iterations);
    const a = Buffer.from(calculated, "base64");
    const b = Buffer.from(hashPart, "base64");
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch (_) {
    return false;
  }
}

// Genera un hash compatible con Django para nuevas contraseñas
function makeDjangoPassword(password, options = {}) {
  const algorithm = "pbkdf2_sha256";
  const iterations = options.iterations || 720000; // valor por defecto razonable
  const salt = options.salt || crypto.randomBytes(16).toString("hex");
  const hash = pbkdf2Sha256(password, salt, iterations);
  return [algorithm, iterations, salt, hash].join("$");
}

module.exports = {
  checkDjangoPassword,
  makeDjangoPassword
};

