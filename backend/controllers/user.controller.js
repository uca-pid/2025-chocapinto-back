// src/controllers/user.controller.js
const prisma = require('../db');
const { validateRequiredFields } = require('../utils/validateFields');

const getUserByIdOrUsername = async (req, res) => {
  try {
    const idOrUsername = req.params.idOrUsername;
    let user = null;

    if (!isNaN(Number(idOrUsername))) {
      user = await prisma.user.findUnique({ where: { id: Number(idOrUsername) } });
    } else {
      user = await prisma.user.findUnique({ where: { username: idOrUsername } });
    }

    if (!user) {
      return res.status(404).json({ success: false, message: "Usuario no encontrado" });
    }

    res.json({ success: true, user });
  } catch (error) {
    console.error("Error al obtener usuario:", error);
    res.status(500).json({ success: false, message: "Error del servidor" });
  }
};

const updateUser = async (req, res) => {
  try {
    const { currentUsername, newUsername, newPassword } = req.body;

    if (!currentUsername) {
      return res.status(400).json({ success: false, message: "No se proporcionó el usuario actual" });
    }

    const user = await prisma.user.findUnique({ where: { username: currentUsername } });
    if (!user) {
      return res.status(404).json({ success: false, message: "Usuario no encontrado" });
    }

    // Validar que el nuevo username no esté en uso
    if (newUsername && newUsername !== currentUsername) {
      const exists = await prisma.user.findUnique({ where: { username: newUsername } });
      if (exists) {
        return res.status(400).json({ success: false, message: "Nombre de usuario ya en uso" });
      }
    }

    const updatedUser = await prisma.user.update({
      where: { username: currentUsername },
      data: {
        username: newUsername || currentUsername,
        ...(newPassword ? { password: newPassword } : {})
      },
      select: { username: true, role: true }
    });

    res.json({ success: true, message: "Usuario actualizado", user: updatedUser });
  } catch (error) {
    console.error("Error al actualizar usuario:", error);
    res.status(500).json({ success: false, message: "Error del servidor" });
  }
};

const deleteUser = async (req, res) => {
  try {
    const { username } = req.body;

    if (!username) {
      return res.status(400).json({ success: false, message: "Falta el nombre de usuario" });
    }

    const user = await prisma.user.findUnique({ where: { username } });
    if (!user) {
      return res.status(404).json({ success: false, message: "Usuario no encontrado" });
    }

    await prisma.user.delete({ where: { username } });
    res.json({ success: true, message: "Usuario eliminado" });
  } catch (error) {
    console.error("Error al eliminar usuario:", error);
    res.status(500).json({ success: false, message: "Error al eliminar usuario" });
  }
};

module.exports = {
  getUserByIdOrUsername,
  updateUser,
  deleteUser
};