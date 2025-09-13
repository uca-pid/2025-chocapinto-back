
const express = require("express");
const { PrismaClient } = require("@prisma/client");
const cors = require("cors");

const app = express();
const prisma = new PrismaClient();

app.use(cors());
app.use(express.json());

// Registro
app.post("/register", async (req, res) => {
  const { username, password, role } = req.body;
  try {
    const user = await prisma.user.create({
      data: { username, password, role }
    });
    res.status(201).json({ success: true, message: "Usuario registrado con éxito" });
  } catch (error) {
    res.status(400).json({ success: false, message: "El usuario ya existe" });
  }
});

// Login
app.post("/login", async (req, res) => {
  const { username, password } = req.body;
  const user = await prisma.user.findUnique({ where: { username } });

  if (!user || user.password !== password) {
    return res.status(401).json({ success: false, message: "Credenciales inválidas" });
  }

  res.json({ success: true, message: "Login exitoso", role: user.role });
});

// Actualizar usuario
app.put("/updateUser", async (req, res) => {
  try {
    const { currentUsername, newUsername, newPassword } = req.body;

    if (!currentUsername) {
      return res.status(400).json({ success: false, message: "No se proporcionó el usuario actual" });
    }

    const user = await prisma.user.findUnique({ where: { username: currentUsername } });
    if (!user) return res.status(404).json({ success: false, message: "Usuario no encontrado" });

    // Validar que el nuevo username no esté en uso
    if (newUsername && newUsername !== currentUsername) {
      const exists = await prisma.user.findUnique({ where: { username: newUsername } });
      if (exists) return res.status(400).json({ success: false, message: "Nombre de usuario ya en uso" });
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
    console.error(error);
    res.status(500).json({ success: false, message: "Error del servidor" });
  }
});
// Eliminar usuario
// Cambiar DELETE a POST
app.post("/deleteUser", async (req, res) => {
  const { username } = req.body;
  if (!username) {
    return res.status(400).json({ success: false, message: "Falta el nombre de usuario" });
  }
  try {
    const user = await prisma.user.findUnique({ where: { username } });
    if (!user) {
      return res.status(404).json({ success: false, message: "Usuario no encontrado" });
    }
    await prisma.user.delete({ where: { username } });
    res.json({ success: true, message: "Usuario eliminado" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Error al eliminar usuario" });
  }
});

app.listen(5000, () => console.log("✅ Server en http://localhost:5000"));
