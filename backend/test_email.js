require("dotenv").config();
const { sendPasswordResetEmail } = require("./utils/mail");

async function main() {
  const destinatario = "TU_MAIL_REAL@loquesea.com";  // poné un mail tuyo
  const linkPrueba = "https://example.com/reset-password?token=PRUEBA";

  try {
    await sendPasswordResetEmail(destinatario, linkPrueba);
    console.log("✅ Mail de prueba enviado correctamente");
  } catch (err) {
    console.error("❌ Error enviando mail de prueba:", err);
  }
}

main();
