// src/controllers/auth.controller.js
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const prisma = require('../db');
const { sendPasswordResetEmail } = require("../utils/mail");
const { hashPassword, comparePassword } = require('../utils/hashPassword');
const { validateRequiredFields, validateEmail, validatePassword } = require('../utils/validateFields');

/**
 * Registra un nuevo usuario en el sistema
 * Ruta: POST /auth/register
 */
const register = async (req, res) => {
  try {
    const { username, email, password } = req.body;

    const missingFields = validateRequiredFields(['username', 'email', 'password'], req.body);
    if (missingFields) {
      return res.status(400).json({ 
        success: false, 
        message: `Faltan campos requeridos: ${missingFields.join(', ')}` 
      });
    }

    if (!validateEmail(email)) {
      return res.status(400).json({ success: false, message: "Email inválido" });
    }

    if (!validatePassword(password)) {
      return res.status(400).json({ 
        success: false, 
        message: "La contraseña debe tener al menos 6 caracteres" 
      });
    }

    const hashedPassword = await hashPassword(password);

    const user = await prisma.user.create({
      data: { 
        username, 
        email, 
        password: hashedPassword, 
        role: "reader" 
      }
    });

    res.status(201).json({ 
      success: true, 
      message: "Usuario registrado con éxito", 
      user: { 
        id: user.id, 
        username: user.username, 
        email: user.email, 
        role: user.role 
      }
    });
  } catch (error) {
    if (error.code === "P2002") {
      res.status(400).json({ success: false, message: "El usuario o email ya existe" });
    } else {
      console.error("[ERROR] Error al registrar usuario:", error);
      res.status(500).json({ success: false, message: "Error del servidor" });
    }
  }
};

/**
 * Autentica un usuario existente
 * Ruta: POST /auth/login
 */
const login = async (req, res) => {
  try {
    const { username, password } = req.body;

    const missingFields = validateRequiredFields(['username', 'password'], req.body);
    if (missingFields) {
      return res.status(400).json({ success: false, message: "Faltan credenciales" });
    }

    const user = await prisma.user.findUnique({ where: { username } });
    if (!user) {
      return res.status(401).json({ success: false, message: "Credenciales inválidas" });
    }

    const isPasswordValid = await comparePassword(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ success: false, message: "Credenciales inválidas" });
    }

    res.json({ 
      success: true, 
      message: "Login exitoso", 
      role: user.role, 
      id: user.id 
    });
  } catch (error) {
    console.error("[ERROR] Error en login:", error);
    res.status(500).json({ success: false, message: "Error interno del servidor" });
  }
};

/**
 * Cambia la contraseña de un usuario autenticado
 * Ruta: POST /auth/change-password
 */
const changePassword = async (req, res) => {
  try {
    const { currentUsername, currentPassword, newPassword } = req.body;

    const missingFields = validateRequiredFields(['currentUsername', 'currentPassword', 'newPassword'], req.body);
    if (missingFields) {
      return res.status(400).json({ success: false, message: "Faltan datos requeridos" });
    }

    if (!validatePassword(newPassword)) {
      return res.status(400).json({ 
        success: false, 
        message: "La nueva contraseña debe tener al menos 6 caracteres" 
      });
    }

    const user = await prisma.user.findUnique({ where: { username: currentUsername } });
    if (!user) {
      return res.status(404).json({ success: false, message: "Usuario no encontrado" });
    }

    const isPasswordValid = await comparePassword(currentPassword, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ success: false, message: "Contraseña actual incorrecta" });
    }

    const hashedNewPassword = await hashPassword(newPassword);

    await prisma.user.update({
      where: { username: currentUsername },
      data: { password: hashedNewPassword }
    });

    res.json({ success: true, message: "Contraseña actualizada con éxito" });
  } catch (error) {
    console.error("[ERROR] Error al cambiar contraseña:", error);
    res.status(500).json({ success: false, message: "Error interno del servidor" });
  }
};

/**
 * Solicita un token de reseteo de contraseña
 * Ruta: POST /auth/forgot-password
 */
const requestPasswordReset = async (req, res) => {
  try {
    const { email } = req.body;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.json({ 
        success: true, 
        message: "Si el correo existe, se envió un enlace." 
      });
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const tokenExpiration = new Date(Date.now() + 3600000);

    await prisma.passwordResetToken.deleteMany({ where: { userId: user.id } });
    
    await prisma.passwordResetToken.create({
      data: {
        token: resetToken,
        userId: user.id,
        expiresAt: tokenExpiration
      }
    });

    const resetLink = `https://booksy-front-juani.onrender.com/html/reset-password.html?token=${resetToken}`;
    await sendPasswordResetEmail(email, resetLink);

    res.json({ success: true, message: "Correo enviado" });

  } catch (error) {
    console.error("[ERROR] Error al solicitar reset de contraseña:", error);
    res.status(500).json({ success: false, message: "Error al procesar solicitud" });
  }
};

/**
 * Resetea la contraseña usando un token válido
 * Ruta: POST /auth/reset-password
 */
const resetPassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    const tokenRecord = await prisma.passwordResetToken.findUnique({
      where: { token },
      include: { user: true }
    });

    if (!tokenRecord) {
      return res.status(400).json({ success: false, message: "Token inválido o expirado" });
    }

    if (tokenRecord.expiresAt < new Date()) {
      return res.status(400).json({ 
        success: false, 
        message: "El token ha expirado. Pide uno nuevo." 
      });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await prisma.user.update({
      where: { id: tokenRecord.userId },
      data: { password: hashedPassword }
    });

    await prisma.passwordResetToken.delete({ where: { id: tokenRecord.id } });

    res.json({ success: true, message: "Contraseña actualizada correctamente" });

  } catch (error) {
    console.error("[ERROR] Error al resetear contraseña:", error);
    res.status(500).json({ success: false, message: "Error al cambiar contraseña" });
  }
};

module.exports = {
  register,
  login,
  changePassword,
  requestPasswordReset,
  resetPassword
};