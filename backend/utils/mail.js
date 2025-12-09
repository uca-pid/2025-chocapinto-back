// backend/utils/mail.js
const { Resend } = require('resend');

// Inicializar Resend con tu API key desde variables de entorno
const resend = new Resend(process.env.RESEND_API_KEY);

// Verificar configuración al iniciar
if (!process.env.RESEND_API_KEY) {
  console.error("❌ Error: RESEND_API_KEY no está configurada");
} else {
  console.log("✅ Resend configurado correctamente");
}

/**
 * Envía un mail de recuperación de contraseña con el link dado.
 * @param {string} to - Correo del usuario.
 * @param {string} resetLink - URL completa para restablecer contraseña.
 */
async function sendPasswordResetEmail(to, resetLink) {
  try {
    const { data, error } = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev',
      to: to,
      subject: '🔐 Recuperación de contraseña - Booksy',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body {
              font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
              line-height: 1.6;
              color: #333;
              max-width: 600px;
              margin: 0 auto;
              padding: 20px;
            }
            .container {
              background: #ffffff;
              border-radius: 10px;
              padding: 30px;
              box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            }
            .logo {
              text-align: center;
              margin-bottom: 30px;
            }
            .logo h1 {
              color: #0984e3;
              font-size: 32px;
              margin: 0;
            }
            .content {
              margin-bottom: 30px;
            }
            .button {
              display: inline-block;
              padding: 14px 30px;
              background: linear-gradient(135deg, #0984e3, #74b9ff);
              color: white;
              text-decoration: none;
              border-radius: 8px;
              font-weight: 600;
              text-align: center;
              margin: 20px 0;
            }
            .button:hover {
              background: linear-gradient(135deg, #0770c4, #5da3e6);
            }
            .footer {
              margin-top: 30px;
              padding-top: 20px;
              border-top: 1px solid #eee;
              font-size: 12px;
              color: #666;
              text-align: center;
            }
            .warning {
              background: #fff3cd;
              border-left: 4px solid #ffc107;
              padding: 15px;
              margin: 20px 0;
              border-radius: 4px;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="logo">
              <h1>📚 Booksy</h1>
            </div>
            
            <div class="content">
              <h2 style="color: #2d3436;">Recuperación de contraseña</h2>
              <p>Hola,</p>
              <p>Recibimos una solicitud para restablecer la contraseña de tu cuenta en Booksy.</p>
              <p>Hacé clic en el siguiente botón para crear una nueva contraseña:</p>
              
              <div style="text-align: center;">
                <a href="${resetLink}" class="button">Restablecer contraseña</a>
              </div>
              
              <p style="font-size: 14px; color: #666;">
                O copiá y pegá este enlace en tu navegador:<br>
                <a href="${resetLink}" style="color: #0984e3; word-break: break-all;">${resetLink}</a>
              </p>
              
              <div class="warning">
                <strong>⚠️ Importante:</strong>
                <ul style="margin: 10px 0; padding-left: 20px;">
                  <li>Este enlace es válido por <strong>1 hora</strong></li>
                  <li>Solo se puede usar <strong>una vez</strong></li>
                  <li>Si no solicitaste este cambio, podés ignorar este correo</li>
                </ul>
              </div>
            </div>
            
            <div class="footer">
              <p>Este es un correo automático, por favor no respondas a este mensaje.</p>
              <p>© ${new Date().getFullYear()} Booksy - Tu club de lectura online</p>
            </div>
          </div>
        </body>
        </html>
      `,
    });

    if (error) {
      console.error('❌ Error enviando email con Resend:', error);
      throw error;
    }

    console.log(`📧 Mail de recuperación enviado a ${to} (ID: ${data.id})`);
    return data;
  } catch (error) {
    console.error('❌ Error al enviar mail:', error);
    throw error;
  }
}

module.exports = {
  sendPasswordResetEmail,
};