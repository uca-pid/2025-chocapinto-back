// src/controllers/auth.controller.js
const prisma = require('../db');
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

module.exports = {
  register,
  login,
  changePassword
};