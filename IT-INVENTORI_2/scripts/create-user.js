/**
 * Crea el usuario de acceso: Jahdiel / Securecorp123
 * Uso: node scripts/create-user.js
 */
require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });

const { query } = require("../src/utils/db");
const { makeDjangoPassword } = require("../src/utils/djangoPassword");

const USERNAME = "Jahdiel";
const PASSWORD = "Securecorp123";

async function main() {
  await require("../src/utils/db").init();

  const existing = await query(
    "SELECT id FROM auth_user WHERE username = ? LIMIT 1",
    [USERNAME]
  );

  if (existing && existing.length > 0) {
    await query("UPDATE auth_user SET password = ?, is_staff = 1, is_superuser = 1, is_active = 1 WHERE username = ?", [
      makeDjangoPassword(PASSWORD),
      USERNAME
    ]);
    console.log(`Usuario "${USERNAME}" actualizado. Contraseña restablecida.`);
  } else {
    const passwordHash = makeDjangoPassword(PASSWORD);
    await query(
      `INSERT INTO auth_user (password, is_superuser, username, first_name, last_name, email, is_staff, is_active, date_joined)
       VALUES (?, 1, ?, ?, '', ?, 1, 1, datetime('now'))`,
      [passwordHash, USERNAME, USERNAME, `${USERNAME}@securecorp.com`]
    );
    console.log(`Usuario "${USERNAME}" creado correctamente.`);
  }

  console.log(`  Login: ${USERNAME}`);
  console.log(`  Contraseña: ${PASSWORD}`);
  process.exit(0);
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
