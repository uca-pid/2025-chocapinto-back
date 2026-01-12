const nodemailer = require("nodemailer");

// Configuramos el transporter usando las variables de entorno
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,                 // smtp.gmail.com
  port: Number(process.env.EMAIL_PORT) || 587,  // 587 por defecto
  secure: false,                                // con 587 va en false (TLS por starttls)
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// (Opcional) verificar la conexión con el servidor SMTP al iniciar
transporter.verify((error, success) => {
  if (error) {
    console.error("❌ Error configurando el SMTP:", error.message);
  } else {
    console.log("✅ SMTP listo para enviar correos");
  }
});

/**
 * Envía un mail de recuperación de contraseña con el link dado.
 * @param {string} to - Correo del usuario.
 * @param {string} resetLink - URL completa para restablecer contraseña.
 */
async function sendPasswordResetEmail(to, resetLink) {
  const mailOptions = {
    from: `"Mi App" <${process.env.EMAIL_USER}>`,
    to,
    subject: "Recuperación de contraseña",
    html: `
      <p>Hola,</p>
      <p>Recibimos una solicitud para restablecer tu contraseña.</p>
      <p>Hacé clic en el siguiente enlace para continuar:</p>
      <p><a href="${resetLink}" target="_blank">${resetLink}</a></p>
      <p>Este enlace es válido por un tiempo limitado. Si no solicitaste este cambio, podés ignorar este correo.</p>
    `,
  };

  await transporter.sendMail(mailOptions);
  console.log(`📧 Mail de recuperación enviado a ${to}`);
}

module.exports = {
  sendPasswordResetEmail,
};
