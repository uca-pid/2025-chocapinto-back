// src/controllers/auth.controller.js
const crypto = require("crypto");
const prisma = require('../db');
const { sendPasswordResetEmail } = require("../utils/mail");
const bcrypt = require("bcryptjs");
const { hashPassword, comparePassword } = require('../utils/hashPassword');
const { validateRequiredFields, validateEmail, validatePassword } = require('../utils/validateFields');

const register = async (req, res) => {
  try {
    const { username, email, password } = req.body;

    // Validar campos requeridos
    const missingFields = validateRequiredFields(['username', 'email', 'password'], req.body);
    if (missingFields) {
      return res.status(400).json({ 
        success: false, 
        message: `Faltan campos requeridos: ${missingFields.join(', ')}` 
      });
    }

    // Validar email
    if (!validateEmail(email)) {
      return res.status(400).json({ success: false, message: "Email inválido" });
    }

    // Validar contraseña
    if (!validatePassword(password)) {
      return res.status(400).json({ success: false, message: "La contraseña debe tener al menos 6 caracteres" });
    }

    // Hashear contraseña
    const hashedPassword = await hashPassword(password);

    // Crear usuario
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
      user: { id: user.id, username: user.username, email: user.email, role: user.role }
    });
  } catch (error) {
    if (error.code === "P2002") {
      res.status(400).json({ success: false, message: "El usuario o email ya existe" });
    } else {
      console.error("Error al registrar:", error);
      res.status(500).json({ success: false, message: "Error del servidor" });
    }
  }
};

const login = async (req, res) => {
  try {
    const { username, password } = req.body;

    // Validar campos
    const missingFields = validateRequiredFields(['username', 'password'], req.body);
    if (missingFields) {
      return res.status(400).json({ success: false, message: "Faltan credenciales" });
    }

    // Buscar usuario
    const user = await prisma.user.findUnique({ where: { username } });
    if (!user) {
      return res.status(401).json({ success: false, message: "Credenciales inválidas" });
    }

    // Verificar contraseña
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
    console.error("Error en login:", error);
    res.status(500).json({ success: false, message: "Error interno del servidor" });
  }
};

const changePassword = async (req, res) => {
  try {
    const { currentUsername, currentPassword, newPassword } = req.body;

    const missingFields = validateRequiredFields(['currentUsername', 'currentPassword', 'newPassword'], req.body);
    if (missingFields) {
      return res.status(400).json({ success: false, message: "Faltan datos requeridos" });
    }

    if (!validatePassword(newPassword)) {
      return res.status(400).json({ success: false, message: "La nueva contraseña debe tener al menos 6 caracteres" });
    }

    // Buscar usuario
    const user = await prisma.user.findUnique({ where: { username: currentUsername } });
    if (!user) {
      return res.status(404).json({ success: false, message: "Usuario no encontrado" });
    }

    // Verificar contraseña actual
    const isPasswordValid = await comparePassword(currentPassword, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ success: false, message: "Contraseña actual incorrecta" });
    }

    // Hashear nueva contraseña
    const hashedNewPassword = await hashPassword(newPassword);

    // Actualizar contraseña
    await prisma.user.update({
      where: { username: currentUsername },
      data: { password: hashedNewPassword }
    });

    res.json({ success: true, message: "Contraseña actualizada con éxito" });
  } catch (error) {
    console.error("Error al cambiar contraseña:", error);
    res.status(500).json({ success: false, message: "Error interno del servidor" });
  }
};

// Solicitud de recuperación de contraseña
const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: "El email es obligatorio." });
    }

    // Buscar usuario por email
    const user = await prisma.user.findFirst({
      where: { email: email },
    });

    // Respuesta genérica (aunque no exista el usuario)
    if (!user) {
      return res.json({
        message:
          "Si el correo existe en nuestro sistema, te enviamos un mail con instrucciones.",
      });
    }

    // Eliminar tokens viejos de este usuario
    await prisma.passwordResetToken.deleteMany({
      where: { userId: user.id },
    });

    // Token aleatorio
    const token = crypto.randomBytes(32).toString("hex");

    // Expira en 1 hora
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    // Guardar token
    await prisma.passwordResetToken.create({
      data: {
        token,
        expiresAt,
        userId: user.id,
      },
    });

    // URL hacia el front
    const baseUrl =
      process.env.RESET_PASSWORD_BASE_URL || "http://localhost:5173";

    const resetLink = `${baseUrl}?token=${token}`;


    // Enviar email
    await sendPasswordResetEmail(email, resetLink);

    return res.json({
      message:
        "Si el correo existe en nuestro sistema, te enviamos un mail con instrucciones.",
    });
  } catch (error) {
    console.error("Error en forgotPassword:", error);
    return res.status(500).json({ message: "Error interno del servidor." });
  }
};

const resetPassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res
        .status(400)
        .json({ message: "Token y nueva contraseña son obligatorios." });
    }

    // 1) Buscar el registro del token
    const record = await prisma.passwordResetToken.findFirst({
      where: { token },
    });

    if (!record) {
      return res.status(400).json({ message: "Token inválido." });
    }

    // 2) Verificar si ya fue usado
    if (record.used) {
      return res
        .status(400)
        .json({ message: "Este enlace ya fue utilizado." });
    }

    // 3) Verificar si está vencido
    if (record.expiresAt < new Date()) {
      return res.status(400).json({ message: "El enlace ha expirado." });
    }

    // 4) Buscar al usuario asociado
    const user = await prisma.user.findFirst({
      where: { id: record.userId },
    });

    if (!user) {
      return res.status(400).json({ message: "Usuario no encontrado." });
    }

    // 5) Hashear la nueva contraseña
    const hashed = await bcrypt.hash(newPassword, 10);

    // 6) Actualizar contraseña del usuario
    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashed },
    });

    // 7) Marcar el token como usado
    await prisma.passwordResetToken.update({
      where: { id: record.id },
      data: { used: true },
    });

    return res.json({ message: "Contraseña actualizada correctamente." });
  } catch (error) {
    console.error("Error en resetPassword:", error);
    return res.status(500).json({ message: "Error interno del servidor." });
  }
};



module.exports = {
  register,
  login,
  changePassword,
  forgotPassword,
  resetPassword
};