
const express = require("express");
const { PrismaClient } = require("@prisma/client");
const cors = require("cors");

const app = express();
const prisma = new PrismaClient();

app.use(cors());
app.use(express.json());
// Obtener datos de usuario por username
app.get("/user/:username", async (req, res) => {
  const username = req.params.username;
  try {
    const user = await prisma.user.findUnique({ where: { username } });
    if (!user) return res.status(404).json({ success: false, message: "Usuario no encontrado" });
    res.json({ success: true, user });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error del servidor" });
  }
});
// Registro
app.post("/register", async (req, res) => {
  const { username, email, password } = req.body;

  if (!username || !email || !password) {
    return res.status(400).json({ success: false, message: "Faltan datos" });
  }

  try {
    const user = await prisma.user.create({
      data: { username, email, password, role: "reader" }
    });
    res.status(201).json({ success: true, message: "Usuario registrado con éxito", user });
  } catch (error) {
    if (error.code === "P2002") {
      res.status(400).json({ success: false, message: "El usuario ya existe" });
    } else {
      res.status(500).json({ success: false, message: "Error del servidor", error: error.message });
    }
  }
});

// Login
app.post("/login", async (req, res) => {
  const { username, password } = req.body;
  const user = await prisma.user.findUnique({ where: { username } });

  if (!user || user.password !== password) {
    return res.status(401).json({ success: false, message: "Credenciales inválidas" });
  }

  res.json({ success: true, message: "Login exitoso", role: user.role, id: user.id });
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

// Crear Club
app.post("/createClub", async (req, res) => {
    console.log("Body recibido:", req.body); 
  try {
    const { name, description, ownerUsername } = req.body;

    if (!name || !description || !ownerUsername) {
      return res.status(400).json({ success: false, message: "Faltan datos" });
    }

    const owner = await prisma.user.findUnique({ where: { username: ownerUsername } });
    if (!owner) return res.status(404).json({ success: false, message: "Usuario no encontrado" });
    console.log("Owner encontrado:", owner);
    // Crear club
    const club = await prisma.club.create({
      data: {
        name,
        description,
        id_owner: owner.id,
        members: {
          connect: { id: owner.id } // el creador se agrega como miembro
        }
      },
      include: { members: true } // opcional, para devolver los miembros
    });


    res.json({ success: true, club });
  } catch (error) {
    console.error("Error en createClub:", error);
    res.status(500).json({ success: false, message: "Error del servidor" });
  }
});
// Obtener todos los clubes con info de miembros
app.get("/clubs", async (req, res) => {
  try {
    const clubs = await prisma.club.findMany({
      include: { members: true }
    });
    res.json({ success: true, clubs });
  } catch (error) {
    console.error("Error al obtener clubes:", error);
    res.status(500).json({ success: false, message: "Error del servidor" });
  }
});
// Unirse a un club
app.post("/joinClub", async (req, res) => {
  try {
    const { clubId, username } = req.body;
    if (!clubId || !username) return res.status(400).json({ success: false, message: "Faltan datos" });

    const user = await prisma.user.findUnique({ where: { username } });
    if (!user) return res.status(404).json({ success: false, message: "Usuario no encontrado" });

    // Revisar si ya es miembro
    const club = await prisma.club.findUnique({
      where: { id: clubId },
      include: { members: true }
    });

    if (club.members.some(m => m.id === user.id)) {
      return res.json({ success: false, message: "Ya eres miembro del club" });
    }

    // Conectar al usuario como miembro
    await prisma.club.update({
      where: { id: clubId },
      data: { members: { connect: { id: user.id } } }
    });

    res.json({ success: true, message: "Te uniste al club correctamente" });
  } catch (error) {
    console.error("Error al unirse al club:", error);
    res.status(500).json({ success: false, message: "Error del servidor" });
  }
});
// Obtener club por id
app.get("/club/:id", async (req, res) => {
  const clubId = Number(req.params.id);
  if (!clubId) return res.status(400).json({ success: false, message: "ID inválido" });
  try {
    const club = await prisma.club.findUnique({
      where: { id: clubId },
      include: { readBooks: true }
    });
    console.log("GET /club/:id", { clubId, club });
    if (!club) return res.status(404).json({ success: false, message: "Club no encontrado" });
    res.json({
      success: true,
      club: {
        id: club.id,
        name: club.name,
        description: club.description,
        id_owner: club.id_owner,
        readBooks: club.readBooks
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error al buscar club" });
  }
});

// --- CIERRA ESTA FUNCIÓN ANTES DE LA SIGUIENTE RUTA ---
app.post("/club/:id/addBook", async (req, res) => {
  const clubId = Number(req.params.id);
  const { title, author } = req.body;
  console.log("Datos recibidos en /club/:id/addBook:", { clubId, title, author });
  if (!clubId || !title) {
    return res.status(400).json({ success: false, message: "Faltan datos obligatorios" });
  }
  try {
    // Crear el libro y asociarlo al club
    const book = await prisma.book.create({
      data: {
        title,
        author,
        clubs: { connect: { id: clubId } }
      }
    });
    res.json({ success: true, message: "Libro agregado", book });
  } catch (error) {
    console.error("Error al agregar libro:", error);
    res.status(500).json({ success: false, message: "Error al agregar libro" });
  }
}); // <-- CIERRA AQUÍ

// Eliminar libro leído del club (solo owner)
app.delete("/club/:id/deleteBook/:bookId", async (req, res) => {
  const clubId = Number(req.params.id);
  const bookId = Number(req.params.bookId);
  const { username } = req.body;
  if (!clubId || !bookId || !username) {
    return res.status(400).json({ success: false, message: "Faltan datos obligatorios" });
  }
  try {
    // Buscar el club y verificar owner
    const club = await prisma.club.findUnique({
      where: { id: clubId },
      include: { readBooks: true }
    });
    if (!club) return res.status(404).json({ success: false, message: "Club no encontrado" });
    const user = await prisma.user.findUnique({ where: { username } });
    if (!user) return res.status(404).json({ success: false, message: "Usuario no encontrado" });
    if (club.id_owner !== user.id) {
      return res.status(403).json({ success: false, message: "No tienes permisos para eliminar libros" });
    }
    // Verificar que el libro esté en el club
    const libroEnClub = club.readBooks.some(b => b.id === bookId);
    if (!libroEnClub) {
      return res.status(404).json({ success: false, message: "El libro no pertenece a este club" });
    }
    // Eliminar la relación libro-club
    await prisma.book.update({
      where: { id: bookId },
      data: { clubs: { disconnect: { id: clubId } } }
    });
    // Opcional: eliminar el libro si no está en ningún club
    const libro = await prisma.book.findUnique({ where: { id: bookId }, include: { clubs: true } });
    if (libro.clubs.length === 0) {
      await prisma.book.delete({ where: { id: bookId } });
    }
    res.json({ success: true, message: "Libro eliminado del club" });
  } catch (error) {
    console.error("Error al eliminar libro:", error);
    res.status(500).json({ success: false, message: "Error al eliminar libro" });
  }
});
// Obtener todos los libros
app.get("/books", async (req, res) => {
  try {
    const books = await prisma.book.findMany();
    res.json({ success: true, books });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error al obtener libros" });
  }
});

app.listen(5000, () => console.log("✅ Server en http://localhost:5000"));
