const express = require("express");
const cors = require("cors");
const prisma = require("./db"); 
const bcrypt = require("bcryptjs"); 

const app = express();

app.use(cors());
app.use(express.json());
// Obtener datos de usuario por username
//pasado a controlador USER
app.get("/user/:idOrUsername", async (req, res) => {
  const idOrUsername = req.params.idOrUsername;
  let user = null;
  try {
    if (!isNaN(Number(idOrUsername))) {
      user = await prisma.user.findUnique({ where: { id: Number(idOrUsername) } });
    } else {
      user = await prisma.user.findUnique({ where: { username: idOrUsername } });
    }
    if (!user) return res.status(404).json({ success: false, message: "Usuario no encontrado" });
    res.json({ success: true, user });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error del servidor" });
  }
});

// Registro
// pasado a controlador AUTH
app.post("/register", async (req, res) => {
  const { username, email, password } = req.body;

  if (!username || !email || !password) {
    return res.status(400).json({ success: false, message: "Faltan datos" });
  }

  try {
    // 1. Generar un salt (semilla aleatoria)
    const salt = await bcrypt.genSalt(10);
    
    // 2. Hashear la contraseña usando el salt
    const hashedPassword = await bcrypt.hash(password, salt); // << PASO CRÍTICO

    // 3. Guardar el usuario con la contraseña HASHEADA
    const user = await prisma.user.create({
      data: { 
        username, 
        email, 
        password: hashedPassword, // << AHORA SE GUARDA EL HASH SEGURO
        role: "reader" 
      }
    });

    res.status(201).json({ success: true, message: "Usuario registrado con éxito", user });
  } catch (error) {
    if (error.code === "P2002") {
      res.status(400).json({ success: false, message: "El usuario ya existe" });
    } else {
      console.error("Error al registrar:", error);
      res.status(500).json({ success: false, message: "Error del servidor", error: error.message });
    }
  }
});

// app.js (CÓDIGO CORREGIDO para el Login)
// // pasado a controlador AUTH
app.post("/login", async (req, res) => {
  const { username, password } = req.body;

  try {
    const user = await prisma.user.findUnique({ where: { username } });

    // 1. Verificar si el usuario existe
    if (!user) {
      // Usar un mensaje genérico por seguridad
      return res.status(401).json({ success: false, message: "Credenciales inválidas" });
    }

    // 2. 🔑 COMPARACIÓN CORRECTA DE HASH: 
    // Compara el texto plano (password) con el hash guardado (user.password)
    const isPasswordValid = await bcrypt.compare(password, user.password); // <-- ESTO ES LO CRÍTICO

    if (!isPasswordValid) {
      return res.status(401).json({ success: false, message: "Credenciales inválidas" });
    }

    // 3. Login exitoso
    res.json({ success: true, message: "Login exitoso", role: user.role, id: user.id });

  } catch (error) {
    console.error("Error en login:", error);
    res.status(500).json({ success: false, message: "Error interno del servidor" });
  }
});

// Actualizar usuario
// pasado a controlador USER
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
    //console.error(error);
    res.status(500).json({ success: false, message: "Error del servidor" });
  }
});

// Eliminar usuario
// Cambiar DELETE a POST
// pasado a controlador USER
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
    //console.error(error);
    res.status(500).json({ success: false, message: "Error al eliminar usuario" });
  }
});

// Crear Club
// pasado a controlador CLUB
app.post("/createClub", async (req, res) => {
  try {
    const { name, description, ownerUsername, imagen } = req.body;

    if (!name || !description || !ownerUsername) {
      return res.status(400).json({ success: false, message: "Faltan datos" });
    }

    const owner = await prisma.user.findUnique({ where: { username: ownerUsername } });
    if (!owner) return res.status(404).json({ success: false, message: "Usuario no encontrado" });

    // Imagen por defecto si no mandan una
    const defaultImg = "https://img.lovepik.com/png/20231109/book-cartoon-illustration-school-start-reading-reading-book_539915_wh860.png";

    const club = await prisma.club.create({
      data: {
        name,
        description,
        id_owner: owner.id,
        imagen: imagen || defaultImg,
        members: {
          connect: { id: owner.id }
        }
      },
      include: { members: true }
    });

    res.json({ success: true, club });
  } catch (error) {
    console.error("Error en createClub:", error);
    res.status(500).json({ success: false, message: "Error del servidor" });
  }
});
// pasado a controlador CLUB
app.delete("/deleteClub/:id", async (req, res) => {
  const clubId = Number(req.params.id);
  if (!clubId) return res.status(400).json({ success: false, message: "ID inválido" });
  try {
    await prisma.club.delete({ where: { id: clubId } });
    res.json({ success: true, message: "Club eliminado" });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error del servidor" });
  }
});

// Obtener todos los clubes con info de miembros
// pasado a controlador CLUB
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
// Crear solicitud de ingreso a club
// pasado a controlador CLUB
app.post("/clubSolicitud", async (req, res) => {
  try {
    const { clubId, username } = req.body;
    if (!clubId || !username) return res.status(400).json({ success: false, message: "Faltan datos" });

    const user = await prisma.user.findUnique({ where: { username } });
    if (!user) return res.status(404).json({ success: false, message: "Usuario no encontrado" });

    // Revisar si ya existe una solicitud pendiente
    const solicitudExistente = await prisma.clubSolicitud.findFirst({
      where: { clubId: Number(clubId), userId: user.id, estado: "pendiente" }
    });
    if (solicitudExistente) {
      return res.json({ success: false, message: "Ya tienes una solicitud pendiente" });
    }

    // Revisar si ya es miembro
    const club = await prisma.club.findUnique({
      where: { id: Number(clubId) },
      include: { members: true }
    });
    if (club.members.some(m => m.id === user.id)) {
      return res.json({ success: false, message: "Ya eres miembro del club" });
    }

    // Crear solicitud
    const solicitud = await prisma.clubSolicitud.create({
      data: {
        clubId: Number(clubId),
        userId: user.id,
        estado: "pendiente"
      }
    });
    res.json({ success: true, message: "Solicitud enviada", solicitud });
  } catch (error) {
    console.error("Error al crear solicitud de ingreso:", error);
    res.status(500).json({ success: false, message: "Error del servidor" });
  }
});
// Obtener club por id
// pasado a controlador CLUB
app.get("/club/:id", async (req, res) => {
  const clubId = Number(req.params.id);
  if (!clubId) return res.status(400).json({ success: false, message: "ID inválido" });
  try {
    const club = await prisma.club.findUnique({
      where: { id: clubId },
      include: {
        clubBooks: {
          include: { 
            book: {
              include: { categorias: true }
            },
            addedBy: true
          }
        },
        solicitudes: {
          include: { user: true }
        },
        members: true
      }
    });
    if (!club) return res.status(404).json({ success: false, message: "Club no encontrado" });
    
    const solicitudes = club.solicitudes ? club.solicitudes.map(s => ({
      id: s.id,
      username: s.user.username,
      estado: s.estado,
      createdAt: s.createdAt
    })) : [];
    
    let ownerName = null;
    if (club.owner) {
      ownerName = club.owner.username;
    } else {
      const ownerUser = await prisma.user.findUnique({ where: { id: club.id_owner } });
      ownerName = ownerUser ? ownerUser.username : null;
    }
    
    res.json({
      success: true,
      club: {
        id: club.id,
        name: club.name,
        description: club.description,
        id_owner: club.id_owner,
        ownerName,
        imagen: club.imagen,
        readBooks: club.clubBooks.map(clubBook => ({
          id: clubBook.book.id,
          title: clubBook.book.title,
          author: clubBook.book.author,
          portada: clubBook.book.portada,
          id_api: clubBook.book.id_api,
          estado: clubBook.estado,
          addedAt: clubBook.addedAt,
          addedBy: clubBook.addedBy.username,
          categorias: clubBook.book.categorias ? clubBook.book.categorias.map(cat => ({ id: cat.id, nombre: cat.nombre })) : []
        })),
        solicitudes,
        members: club.members ? club.members.map(m => ({ id: m.id, username: m.username })) : []
      },
    });
    console.log("Club encontrado:", club);
  } catch (error) {
    console.error("Error al buscar club:", error);
    res.status(500).json({ success: false, message: "Error al buscar club" });
  }
});

//pasado a controlador BOOK
app.post("/club/:id/addBook", async (req, res) => {
  const clubId = Number(req.params.id);
  const { title, author, id_api, thumbnail, categorias, username, estado = "por_leer" } = req.body;
  console.log("Datos recibidos en /club/:id/addBook:", { clubId, title, author, id_api, thumbnail, categorias, username, estado });

  if (!clubId || !title || !username) {
    return res.status(400).json({ success: false, message: "Faltan datos obligatorios" });
  }
  
  try {
    // Buscar el usuario que agrega el libro
    const user = await prisma.user.findUnique({ where: { username } });
    if (!user) {
      return res.status(404).json({ success: false, message: "Usuario no encontrado" });
    }

    // Conectar categorías existentes (por id)
    let categoriasConnect = [];
    if (Array.isArray(categorias)) {
      categoriasConnect = categorias.map(id => ({ id: Number(id) }));
    }

    // Buscar si el libro ya existe
    let book = await prisma.book.findFirst({
      where: {
        title: title,
        author: author || null
      }
    });

    // Si no existe, crear el libro
    if (!book) {
      book = await prisma.book.create({
        data: {
          title,
          author,
          id_api: id_api ? Number(id_api) : undefined,
          portada: thumbnail || undefined,
          categorias: { connect: categoriasConnect }
        }
      });
    } else {
      // Si existe, actualizar las categorías
      await prisma.book.update({
        where: { id: book.id },
        data: {
          categorias: { connect: categoriasConnect }
        }
      });
    }

    // Verificar si ya existe la relación ClubBook
    const existingClubBook = await prisma.clubBook.findUnique({
      where: {
        clubId_bookId: {
          clubId: clubId,
          bookId: book.id
        }
      }
    });

    if (existingClubBook) {
      return res.status(400).json({ success: false, message: "El libro ya está en el club" });
    }

    // Crear la relación ClubBook
    const clubBook = await prisma.clubBook.create({
      data: {
        clubId: clubId,
        bookId: book.id,
        estado: estado,
        addedById: user.id
      },
      include: {
        book: {
          include: {
            categorias: true
          }
        }
      }
    });

    res.json({ success: true, message: "Libro agregado al club", clubBook });
  } catch (error) {
    console.error("Error al agregar libro:", error);
    res.status(500).json({ success: false, message: "Error al agregar libro" });
  }
}); 

// Eliminar libro leído del club (solo owner)
// Aceptar o rechazar solicitud de ingreso a club
// pasado a controlador CLUB
app.put("/club/:clubId/solicitud/:solicitudId", async (req, res) => {
  const clubId = Number(req.params.clubId);
  const solicitudId = Number(req.params.solicitudId);
  const { aceptar } = req.body;
  if (!clubId || !solicitudId || typeof aceptar !== "boolean") {
    return res.status(400).json({ success: false, message: "Faltan datos" });
  }
  try {
    // Buscar la solicitud
    const solicitud = await prisma.clubSolicitud.findUnique({
      where: { id: solicitudId },
      include: { user: true, club: true }
    });
    if (!solicitud || solicitud.clubId !== clubId) {
      return res.status(404).json({ success: false, message: "Solicitud no encontrada" });
    }
    if (solicitud.estado !== "pendiente") {
      return res.status(400).json({ success: false, message: "La solicitud ya fue gestionada" });
    }
    // Actualizar estado
    const nuevoEstado = aceptar ? "aceptada" : "rechazada";
    await prisma.clubSolicitud.update({
      where: { id: solicitudId },
      data: { estado: nuevoEstado }
    });
    // Si se acepta, agregar usuario al club
    if (aceptar) {
      await prisma.club.update({
        where: { id: clubId },
        data: { members: { connect: { id: solicitud.userId } } }
      });
    }
    res.json({ success: true, message: aceptar ? "Usuario agregado al club" : "Solicitud rechazada" });
  } catch (error) {
    console.error("Error al gestionar solicitud:", error);
    res.status(500).json({ success: false, message: "Error del servidor" });
  }
});

//pasado a controlador BOOK
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
      include: { 
        clubBooks: {
          include: { book: true }
        }
      }
    });
    if (!club) return res.status(404).json({ success: false, message: "Club no encontrado" });
    
    const user = await prisma.user.findUnique({ where: { username } });
    if (!user) return res.status(404).json({ success: false, message: "Usuario no encontrado" });
    
    if (club.id_owner !== user.id) {
      return res.status(403).json({ success: false, message: "No tienes permisos para eliminar libros" });
    }
    
    // Verificar que el libro esté en el club
    const clubBook = club.clubBooks.find(cb => cb.book.id === bookId);
    if (!clubBook) {
      return res.status(404).json({ success: false, message: "El libro no pertenece a este club" });
    }
    
    // Eliminar los comentarios relacionados con este ClubBook
    await prisma.comment.deleteMany({
      where: { clubBookId: clubBook.id }
    });
    
    // Eliminar la relación ClubBook
    await prisma.clubBook.delete({
      where: {
        clubId_bookId: {
          clubId: clubId,
          bookId: bookId
        }
      }
    });
    
    // Opcional: eliminar el libro si no está en ningún club
    const otherClubBooks = await prisma.clubBook.findMany({
      where: { bookId: bookId }
    });
    if (otherClubBooks.length === 0) {
      await prisma.book.delete({ where: { id: bookId } });
    }
    
    res.json({ success: true, message: "Libro eliminado del club y comentarios borrados" });
  } catch (error) {
    console.error("Error al eliminar libro:", error);
    res.status(500).json({ success: false, message: "Error al eliminar libro" });
  }
});
// Obtener todos los libros BOOK
app.get("/books", async (req, res) => {
  try {
    const books = await prisma.book.findMany();
    res.json({ success: true, books });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error al obtener libros" });
  }
});

//API Google Books


const GOOGLE_BOOKS_API_URL = "https://www.googleapis.com/books/v1/volumes";

//PASADO A CONTROLADOR BOOK
app.get("/books/search", async (req, res) => {
  const { query } = req.query;
  if (!query) {
    return res.status(400).json({ success: false, message: "Falta el parámetro de búsqueda" });
  }
  try {
    const response = await axios.get(GOOGLE_BOOKS_API_URL, {
      params: {
        q: query,
        key: process.env.GOOGLE_BOOKS_API_KEY
      }
    });
    res.json({ success: true, books: response.data.items });
  } catch (error) {
    console.error("Error al buscar libros en Google Books:", error);
    res.status(500).json({ success: false, message: "Error al buscar libros en Google Books" });
  }
});
// pasado a controlador CLUB
app.delete("/club/:clubId/removeMember/:userId", async (req, res) => {
    const clubId = Number(req.params.clubId);
    const userId = Number(req.params.userId);
    try {
        // Verifica que el usuario a eliminar no sea el owner
        const club = await prisma.club.findUnique({ where: { id: clubId } });
        if (club.id_owner === userId) {
            return res.status(400).json({ success: false, message: "No puedes eliminar al moderador" });
        }
        await prisma.club.update({
            where: { id: clubId },
            data: { members: { disconnect: { id: userId } } }
        });
        res.json({ success: true, message: "Usuario eliminado del club" });
    } catch (error) {
        res.status(500).json({ success: false, message: "Error al eliminar usuario" });
    }
});
// Listar todas las categorías pasado
const categoriasEstaticas = [
  "Ficción",
  "No Ficción",
  "Ciencia Ficción",
  "Fantasía",
  "Ensayo"
];
//pasado a controlador CATEGORIA
app.get("/categorias", async (req, res) => {
  try {
    // Insertar las categorías por defecto si no existen
    for (const nombre of categoriasEstaticas) {
      await prisma.categoria.upsert({
        where: { nombre },
        update: {},
        create: { nombre }
      });
    }
    const categorias = await prisma.categoria.findMany();
    res.json({ success: true, categorias });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error al obtener categorías" });
  }
});

// Crear nueva categoría CATEGORIA
app.post("/categorias", async (req, res) => {
  const { nombre } = req.body;
  if (!nombre) return res.status(400).json({ success: false, message: "Falta el nombre" });
  try {
    const categoria = await prisma.categoria.create({ data: { nombre } });
    res.json({ success: true, categoria });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error al crear categoría" });
  }
});
// Editar categoría CATEGORIA
app.put("/categorias/:id", async (req, res) => {
  const categoriaId = Number(req.params.id);
  const { nombre } = req.body;

  if (!categoriaId || !nombre) {
    return res.status(400).json({ success: false, message: "Faltan datos" });
  }

  try {
    const categoria = await prisma.categoria.findUnique({ where: { id: categoriaId } });
    if (!categoria) {
      return res.status(404).json({ success: false, message: "Categoría no encontrada" });
    }

    // Bloquear edición de estáticas
    if (categoriasEstaticas.includes(categoria.nombre)) {
      return res.status(403).json({ success: false, message: "No se puede editar esta categoría predeterminada" });
    }

    const updated = await prisma.categoria.update({
      where: { id: categoriaId },
      data: { nombre }
    });
    res.json({ success: true, categoria: updated });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error al editar categoría" });
  }
});

// Eliminar categoría
//pasado a controlador CATEGORIA
app.delete("/categorias/:id", async (req, res) => {
  const categoriaId = Number(req.params.id);
  if (!categoriaId) {
    return res.status(400).json({ success: false, message: "ID inválido" });
  }

  try {
    const categoria = await prisma.categoria.findUnique({ where: { id: categoriaId } });
    if (!categoria) {
      return res.status(404).json({ success: false, message: "Categoría no encontrada" });
    }

    // Bloquear eliminación de estáticas
    if (categoriasEstaticas.includes(categoria.nombre)) {
      return res.status(403).json({ success: false, message: "No se puede eliminar esta categoría predeterminada" });
    }

    await prisma.categoria.delete({ where: { id: categoriaId } });
    res.json({ success: true, message: "Categoría eliminada" });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error al eliminar categoría" });
  }
});


//pasado a controlador COMMENT
app.post("/comentario", async (req, res) => {
  let { userId, bookId, clubId, content } = req.body;

  console.log("Datos recibidos:", req.body); // Depuración

  // Convertir a número porque vienen como string del frontend
  userId = Number(userId);
  bookId = Number(bookId);
  clubId = Number(clubId);

  if (!userId || !bookId || !clubId || !content) {
    return res.status(400).json({ success: false, message: "Faltan datos" });
  }
  try {
    // Verificar existencia de usuario
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return res.status(404).json({ success: false, message: "Usuario no encontrado" });
    }

    // Buscar la relación ClubBook
    const clubBook = await prisma.clubBook.findUnique({
      where: {
        clubId_bookId: {
          clubId: clubId,
          bookId: bookId
        }
      }
    });

    if (!clubBook) {
      return res.status(404).json({ success: false, message: "Libro no encontrado en este club" });
    }

    console.log("Usuario encontrado:", user);
    console.log("ClubBook encontrado:", clubBook);

    const comentario = await prisma.comment.create({
      data: {
        content: content,
        user: { connect: { id: userId } },
        clubBook: { connect: { id: clubBook.id } }
      }
    });

    res.json({ success: true, comentario });
  } catch (error) {
    console.error("Error al crear comentario:", error); // Depuración
    res.status(500).json({ success: false, message: "Error al crear comentario", error: error.message });
  }
});

//pasado a controlador COMMENT
app.delete("/comentario/:id", async (req, res) => {
  const comentarioId = Number(req.params.id);
  if (!comentarioId) {
    return res.status(400).json({ success: false, message: "ID de comentario inválido" });
  }
  try {
    const comentario = await prisma.comment.findUnique({ where: { id: comentarioId } });
    if (!comentario) {
      return res.status(404).json({ success: false, message: "Comentario no encontrado" });
    }
    await prisma.comment.delete({ where: { id: comentarioId } });
    res.json({ success: true, message: "Comentario eliminado" });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error al eliminar comentario" });
  }
});

//pasado a controlador COMMET
app.get("/comentario/book/:bookId/club/:clubId", async (req, res) => {
  const bookId = Number(req.params.bookId);
  const clubId = Number(req.params.clubId);
  if (!bookId || !clubId) {
    return res.status(400).json({ success: false, message: "ID de libro o club inválido" });
  }
  try {
    // Buscar la relación ClubBook
    const clubBook = await prisma.clubBook.findUnique({
      where: {
        clubId_bookId: {
          clubId: clubId,
          bookId: bookId
        }
      }
    });
    
    if (!clubBook) {
      return res.status(404).json({ success: false, message: "Libro no encontrado en este club" });
    }

    const comentarios = await prisma.comment.findMany({
      where: { clubBookId: clubBook.id },
      include: { user: { select: { username: true } } }
    });
    res.json({ success: true, comentarios });
  } catch (error) {
    console.error("Error al obtener comentarios:", error);
    res.status(500).json({ success: false, message: "Error al obtener comentarios" });
  }
});

// app.js (Bloque de código a AÑADIR)
// =======================================================
// NUEVO ENDPOINT PARA CAMBIAR CONTRASEÑA
// =======================================================
// pasado a controlador AUTH

app.post("/changePassword", async (req, res) => {
    const { currentUsername, currentPassword, newPassword } = req.body;

    if (!currentUsername || !currentPassword || !newPassword) {
        return res.status(400).json({ success: false, message: "Faltan la contraseña actual o la nueva contraseña." });
    }

    try {
        // 1. Buscar el usuario
        const user = await prisma.user.findUnique({ where: { username: currentUsername } });

        if (!user) {
            return res.status(404).json({ success: false, message: "Usuario no encontrado." });
        }

        // 2. Verificar la contraseña actual (CRÍTICO: usa bcrypt.compare)
        const isPasswordValid = await bcrypt.compare(currentPassword, user.password);
        
        if (!isPasswordValid) {
            return res.status(401).json({ success: false, message: "Contraseña actual incorrecta." });
        }

        // 3. Hashear la nueva contraseña
        const salt = await bcrypt.genSalt(10);
        const hashedNewPassword = await bcrypt.hash(newPassword, salt);

        // 4. Actualizar la contraseña en la base de datos
        await prisma.user.update({
            where: { username: currentUsername },
            data: { password: hashedNewPassword }
        });

        res.json({ success: true, message: "Contraseña actualizada con éxito." });

    } catch (error) {
        console.error("Error al cambiar contraseña:", error);
        res.status(500).json({ success: false, message: "Error interno del servidor al procesar el cambio de contraseña." });
    }
});

// Cambiar estado de un libro en un club
//pasado a controlador BOOK
app.put("/club/:clubId/book/:bookId/estado", async (req, res) => {
  const clubId = Number(req.params.clubId);
  const bookId = Number(req.params.bookId);
  const { estado, username } = req.body;

  if (!clubId || !bookId || !estado || !username) {
    return res.status(400).json({ success: false, message: "Faltan datos obligatorios" });
  }

  // Validar estado
  const estadosValidos = ["por_leer", "leyendo", "leido"];
  if (!estadosValidos.includes(estado)) {
    return res.status(400).json({ 
      success: false, 
      message: "Estado inválido. Debe ser: por_leer, leyendo, o leido" 
    });
  }

  try {
    // Verificar que el usuario existe
    const user = await prisma.user.findUnique({ where: { username } });
    if (!user) {
      return res.status(404).json({ success: false, message: "Usuario no encontrado" });
    }

    // Verificar que el ClubBook existe
    const clubBook = await prisma.clubBook.findUnique({
      where: {
        clubId_bookId: {
          clubId: clubId,
          bookId: bookId
        }
      },
      include: {
        club: {
          include: { members: true }
        }
      }
    });

    if (!clubBook) {
      return res.status(404).json({ 
        success: false, 
        message: "Libro no encontrado en este club" 
      });
    }

    // Verificar que el usuario es miembro del club o el owner
    const isMember = clubBook.club.members.some(member => member.id === user.id);
    const isOwner = clubBook.club.id_owner === user.id;

    if (!isMember && !isOwner) {
      return res.status(403).json({ 
        success: false, 
        message: "No tienes permisos para cambiar el estado de este libro" 
      });
    }

    // Actualizar el estado
    const updatedClubBook = await prisma.clubBook.update({
      where: {
        clubId_bookId: {
          clubId: clubId,
          bookId: bookId
        }
      },
      data: { estado: estado },
      include: {
        book: {
          include: { categorias: true }
        },
        addedBy: true
      }
    });

    // Registrar en el historial
    const historialData = {
      userId: user.id,
      bookId: bookId,
      clubId: clubId,
      estado: estado,
      fechaCambio: new Date()
    };
    
    // Si cambia a "leyendo", registrar fecha de inicio
    if (estado === 'leyendo') {
      historialData.fechaInicio = new Date();
    }
    
    // Si cambia a "leido", registrar fecha de fin
    if (estado === 'leido') {
      historialData.fechaFin = new Date();
      
      // Buscar si había una entrada "leyendo" previa para mantener fechaInicio
      const entradaLeyendo = await prisma.readingHistory.findFirst({
        where: { 
          userId: user.id, 
          bookId: bookId, 
          clubId: clubId, 
          estado: 'leyendo' 
        },
        orderBy: { fechaCambio: 'desc' }
      });
      
      if (entradaLeyendo && entradaLeyendo.fechaInicio) {
        historialData.fechaInicio = entradaLeyendo.fechaInicio;
      }
    }
    
    await prisma.readingHistory.create({ data: historialData });

    res.json({ 
      success: true, 
      message: `Estado del libro cambiado a ${estado} y registrado en historial`,
      clubBook: {
        id: updatedClubBook.book.id,
        title: updatedClubBook.book.title,
        author: updatedClubBook.book.author,
        portada: updatedClubBook.book.portada,
        id_api: updatedClubBook.book.id_api,
        estado: updatedClubBook.estado,
        addedAt: updatedClubBook.addedAt,
        addedBy: updatedClubBook.addedBy.username,
        categorias: updatedClubBook.book.categorias ? updatedClubBook.book.categorias.map(cat => ({ id: cat.id, nombre: cat.nombre })) : []
      }
    });

  } catch (error) {
    console.error("Error al cambiar estado del libro:", error);
    res.status(500).json({ success: false, message: "Error al cambiar estado del libro" });
  }
});

// ==================== RUTAS DEL HISTORIAL ====================

// Obtener historial de un club
//pasado a controlador HISTORY
app.get("/club/:clubId/reading-history", async (req, res) => {
  try {
    const clubId = Number(req.params.clubId);
    const { estado, desde, hasta, userId } = req.query;
    
    // Verificar que el club existe
    const club = await prisma.club.findUnique({
      where: { id: clubId }
    });
    
    if (!club) {
      return res.status(404).json({ success: false, message: "Club no encontrado" });
    }
    
    const whereClause = { clubId };
    
    // Aplicar filtros
    if (estado) whereClause.estado = estado;
    if (userId) whereClause.userId = Number(userId);
    if (desde) whereClause.fechaCambio = { gte: new Date(desde) };
    if (hasta) {
      whereClause.fechaCambio = { 
        ...whereClause.fechaCambio, 
        lte: new Date(hasta) 
      };
    }
    
    const historial = await prisma.readingHistory.findMany({
      where: whereClause,
      include: {
        book: {
          include: {
            categorias: true
          }
        },
        user: { 
          select: { id: true, username: true } 
        }
      },
      orderBy: { fechaCambio: 'desc' }
    });
    
    res.json({ success: true, historial });
  } catch (error) {
    console.error('Error al obtener historial del club:', error);
    res.status(500).json({ success: false, message: "Error al obtener historial del club" });
  }
});

//pasado a controlador
// Obtener estadísticas de lectura del club HISTORY
app.get("/club/:clubId/reading-stats", async (req, res) => {
  try {
    const clubId = Number(req.params.clubId);
    const { año, mes } = req.query;
    
    // Verificar que el club existe
    const club = await prisma.club.findUnique({
      where: { id: clubId }
    });
    
    if (!club) {
      return res.status(404).json({ success: false, message: "Club no encontrado" });
    }
    
    const whereClause = { clubId };
    
    // Filtro por fecha si se especifica
    if (año) {
      const startDate = new Date(año, mes ? mes - 1 : 0, 1);
      const endDate = mes 
        ? new Date(año, mes, 0) 
        : new Date(año + 1, 0, 0);
      whereClause.fechaCambio = { gte: startDate, lte: endDate };
    }
    
    // Obtener todo el historial del club
    const todosLosCambios = await prisma.readingHistory.findMany({
      where: whereClause,
      include: { 
        book: {
          include: {
            categorias: true
          }
        },
        user: { select: { id: true, username: true } }
      }
    });
    
    // Obtener solo libros leídos
    const librosLeidos = todosLosCambios.filter(entry => entry.estado === 'leido');
    
    // Estadísticas por género
    const estadisticasPorGenero = {};
    const estadisticasPorMes = {};
    const estadisticasPorUsuario = {};
    
    librosLeidos.forEach(entry => {
      // Por género
      if (entry.book.categorias && entry.book.categorias.length > 0) {
        entry.book.categorias.forEach(cat => {
          const nombreGenero = cat.nombre;
          estadisticasPorGenero[nombreGenero] = (estadisticasPorGenero[nombreGenero] || 0) + 1;
        });
      } else {
        estadisticasPorGenero['Sin categoría'] = (estadisticasPorGenero['Sin categoría'] || 0) + 1;
      }
      
      // Por mes
      const mes = entry.fechaCambio.toISOString().substring(0, 7); // YYYY-MM
      estadisticasPorMes[mes] = (estadisticasPorMes[mes] || 0) + 1;
      
      // Por usuario
      const username = entry.user.username;
      estadisticasPorUsuario[username] = (estadisticasPorUsuario[username] || 0) + 1;
    });
    
    // Calcular usuario más activo
    const usuarioMasActivo = Object.keys(estadisticasPorUsuario).length > 0 
      ? Object.keys(estadisticasPorUsuario).reduce((a, b) => 
          estadisticasPorUsuario[a] > estadisticasPorUsuario[b] ? a : b
        )
      : null;
    
    // Calcular promedio de tiempo de lectura
    const tiemposLectura = librosLeidos
      .filter(h => h.fechaInicio && h.fechaFin)
      .map(h => {
        const inicio = new Date(h.fechaInicio);
        const fin = new Date(h.fechaFin);
        return Math.ceil((fin - inicio) / (1000 * 60 * 60 * 24));
      });
    
    const promedioLectura = tiemposLectura.length > 0 
      ? Math.round(tiemposLectura.reduce((a, b) => a + b, 0) / tiemposLectura.length)
      : 0;
    
    res.json({
      success: true,
      stats: {
        totalCambios: todosLosCambios.length,
        totalLeidos: librosLeidos.length,
        porGenero: estadisticasPorGenero,
        porMes: estadisticasPorMes,
        porUsuario: estadisticasPorUsuario,
        usuarioMasActivo,
        promedioLectura,
        cambiosRecientes: todosLosCambios.slice(0, 20)
      }
    });
  } catch (error) {
    console.error('Error al obtener estadísticas del club:', error);
    res.status(500).json({ success: false, message: "Error al obtener estadísticas del club" });
  }
});

// module.exports = app;

