// src/controllers/book.controller.js
const prisma = require('../db');
const { validateRequiredFields } = require('../utils/validateFields');
const { computeNewXpAndLevel, XP_REWARDS } = require('../utils/XPRewards');
const { crearNotificacion } = require('./notificaciones.controller');
const { otorgarXP } = require('../utils/XPRewards');

/**
 * Agrega un libro a un club
 * Ruta: POST /api/club/:id/book
 */
const addBookToClub = async (req, res) => {
  try {
    const { title, author, portada, thumbnail, id_api, username, categorias } = req.body;
    const clubId = req.body.clubId || req.params.id;

    if (!title || !clubId || !username) {
      return res.status(400).json({ 
        success: false, 
        message: "Faltan datos requeridos: title, clubId y username son obligatorios" 
      });
    }

    const user = await prisma.user.findUnique({ where: { username } });
    if (!user) {
      return res.status(404).json({ success: false, message: "Usuario no encontrado" });
    }

    const club = await prisma.club.findUnique({
      where: { id: Number(clubId) },
      include: { 
        memberships: {
          include: {
            user: true
          }
        }
      }
    });

    const isMember = club.memberships.some(membership => membership.user.id === user.id) || club.id_owner === user.id;
    if (!isMember) {
      return res.status(403).json({ success: false, message: "No eres miembro de este club" });
    }

    const cleanAuthor = author && author !== "null" && author.trim() !== "" ? author.trim() : null;
    
    let cleanIdApi = null;
    if (id_api && id_api !== "null" && id_api !== "") {
      const parsedId = parseInt(id_api, 10);
      if (!isNaN(parsedId)) {
        cleanIdApi = parsedId;
      }
    }
    
    const cleanPortada = (portada || thumbnail) && (portada || thumbnail) !== "null" && (portada || thumbnail).trim() !== "" 
      ? (portada || thumbnail).trim() 
      : null;

    let book = await prisma.book.findFirst({
      where: {
        OR: [
          ...(cleanIdApi !== null && !isNaN(cleanIdApi) ? [{ id_api: cleanIdApi }] : []),
          { 
            AND: [
              { title: title.trim() }, 
              { author: cleanAuthor }
            ] 
          }
        ]
      }
    });

    if (!book) {
      book = await prisma.book.create({
        data: { 
          title: title.trim(), 
          author: cleanAuthor, 
          portada: cleanPortada, 
          id_api: cleanIdApi 
        }
      });
    } else {
      if (!book.portada && cleanPortada) {
        book = await prisma.book.update({
          where: { id: book.id },
          data: { portada: cleanPortada }
        });
      }
    }

    const existingClubBook = await prisma.clubBook.findFirst({
      where: { clubId: Number(clubId), bookId: book.id }
    });

    if (existingClubBook) {
      return res.status(400).json({ success: false, message: "El libro ya está en el club" });
    }

    await prisma.clubBook.create({
      data: {
        clubId: Number(clubId),
        bookId: book.id,
        addedById: user.id,
        estado: "por_leer"
      }
    });

    await otorgarXP(user.id, 'AGREGAR_LIBRO');

    if (categorias && Array.isArray(categorias) && categorias.length > 0) {
      const categoriasIds = [];
      
      for (const categoria of categorias) {
        if (typeof categoria === 'number' || !isNaN(Number(categoria))) {
          const categoryId = Number(categoria);
          const existingCategory = await prisma.categoria.findUnique({
            where: { id: categoryId }
          });
          
          if (existingCategory) {
            categoriasIds.push({ id: categoryId });
          }
        } else if (typeof categoria === 'string' && categoria.trim() !== '') {
          let cat = await prisma.categoria.findFirst({
            where: { nombre: categoria.trim() }
          });

          if (!cat) {
            const predeterminadas = ["Ficción", "No Ficción", "Ciencia Ficción", "Fantasía", "Ensayo"];
            if (!predeterminadas.includes(categoria.trim())) {
              cat = await prisma.categoria.create({
                data: { nombre: categoria.trim() }
              });
            }
          }
          
          if (cat) {
            categoriasIds.push({ id: cat.id });
          }
        }
      }

      if (categoriasIds.length > 0) {
        await prisma.book.update({
          where: { id: book.id },
          data: {
            categorias: {
              connect: categoriasIds
            }
          }
        });
      }
    }

    const bookWithCategories = await prisma.book.findUnique({
      where: { id: book.id },
      include: { categorias: true }
    });

    res.json({ 
      success: true, 
      message: "Libro agregado al club", 
      book: bookWithCategories 
    });
  } catch (error) {
    console.error("[ERROR] Error al agregar libro:", error);
    res.status(500).json({ success: false, message: "Error interno del servidor" });
  }
};

/**
 * Elimina un libro de un club
 * Ruta: DELETE /api/club/:id/book/:bookId
 */
const removeBookFromClub = async (req, res) => {
  try {
    const clubId = req.body.clubId || req.params.id;
    const bookId = req.body.bookId || req.params.bookId;
    const username = req.body.username;

    if (!clubId || !bookId || !username) {
      return res.status(400).json({ 
        success: false, 
        message: "Faltan datos requeridos: clubId, bookId y username son obligatorios" 
      });
    }

    const user = await prisma.user.findUnique({ where: { username } });
    if (!user) {
      return res.status(404).json({ success: false, message: "Usuario no encontrado" });
    }

    const club = await prisma.club.findUnique({
      where: { id: Number(clubId) },
      include: { 
        memberships: {
          include: {
            user: true
          }
        }
      }
    });

    if (!club) {
      return res.status(404).json({ success: false, message: "Club no encontrado" });
    }

    const isMember = club.memberships.some(membership => membership.user.id === user.id) || club.id_owner === user.id;
    if (!isMember) {
      return res.status(403).json({ success: false, message: "No tienes permisos para eliminar libros de este club" });
    }

    await prisma.$transaction(async (tx) => {
      const clubBook = await tx.clubBook.findFirst({
        where: {
          clubId: Number(clubId),
          bookId: Number(bookId)
        }
      });

      if (!clubBook) {
        throw new Error("El libro no está en este club");
      }

      try {
        await tx.votacionOpcion.deleteMany({
          where: { clubBookId: clubBook.id }
        });
      } catch (votacionError) {
        console.error("[ERROR] Error al eliminar opciones de votación:", votacionError);
      }

      try {
        await tx.periodoLectura.updateMany({
          where: { libroGanadorId: clubBook.id },
          data: { libroGanadorId: null }
        });
      } catch (periodoError) {
        console.error("[ERROR] Error al actualizar períodos de lectura:", periodoError);
      }

      try {
        await tx.comment.deleteMany({
          where: { clubBookId: clubBook.id }
        });
      } catch (commentError) {
        try {
          await tx.comentario.deleteMany({
            where: { 
              clubId: Number(clubId),
              bookId: Number(bookId)
            }
          });
        } catch (comentarioError) {
          console.error("[ERROR] Error al eliminar comentarios:", comentarioError);
        }
      }

      try {
        await tx.readingHistory.deleteMany({
          where: {
            clubId: Number(clubId),
            bookId: Number(bookId)
          }
        });
      } catch (historyError) {
        console.error("[ERROR] Error al eliminar historial de lectura:", historyError);
      }

      await tx.clubBook.delete({
        where: { id: clubBook.id }
      });

      const otherClubBooks = await tx.clubBook.findFirst({
        where: { bookId: Number(bookId) }
      });

      if (!otherClubBooks) {
        const bookToDelete = await tx.book.findUnique({
          where: { id: Number(bookId) },
          include: {
            categorias: true,
            readingHistory: true,
            clubBooks: true
          }
        });
        
        if (bookToDelete.readingHistory.length > 0) {
          await tx.readingHistory.deleteMany({
            where: { bookId: Number(bookId) }
          });
        }

        if (bookToDelete.clubBooks.length > 0) {
          return;
        }

        try {
          await tx.book.update({
            where: { id: Number(bookId) },
            data: {
              categorias: {
                set: []
              }
            }
          });
          
          await tx.book.delete({
            where: { id: Number(bookId) }
          });
        } catch (bookDeleteError) {
          console.error("[ERROR] Error al eliminar el libro completamente:", bookDeleteError);
          throw bookDeleteError;
        }
      }
    });

    res.json({ success: true, message: "Libro eliminado del club" });
  } catch (error) {
    console.error("[ERROR] Error al eliminar libro:", error);
    res.status(500).json({ 
      success: false, 
      message: "Error interno del servidor",
      error: error.message
    });
  }
};

/**
 * Cambia el estado de un libro en un club
 * Ruta: PUT /api/club/:clubId/book/:bookId/status
 */
const changeBookStatus = async (req, res) => {
  try {
    const clubId = Number(req.params.clubId);
    const bookId = Number(req.params.bookId);
    const { estado, username } = req.body;

    const missingFields = validateRequiredFields(['estado', 'username'], req.body);
    if (missingFields) {
      return res.status(400).json({ success: false, message: "Faltan datos requeridos" });
    }

    const validStates = ['por_leer', 'leyendo', 'leido'];
    if (!validStates.includes(estado)) {
      return res.status(400).json({ success: false, message: "Estado inválido" });
    }

    const user = await prisma.user.findUnique({ where: { username } });
    if (!user) {
      return res.status(404).json({ success: false, message: "Usuario no encontrado" });
    }

    const club = await prisma.club.findUnique({
      where: { id: clubId },
      include: {
        memberships: {
          include: {
            user: true,
          },
        },
      },
    });

    if (!club) {
      return res.status(404).json({ success: false, message: "Club no encontrado" });
    }

    const isMember =
      club.memberships.some(membership => membership.user.id === user.id) ||
      club.id_owner === user.id;

    if (!isMember) {
      return res.status(403).json({ success: false, message: "No eres miembro de este club" });
    }

    const clubBookActual = await prisma.clubBook.findFirst({
      where: { clubId, bookId },
    });

    if (!clubBookActual) {
      return res.status(404).json({ success: false, message: "Libro no encontrado en este club" });
    }

    const estabaLeidoAntes = clubBookActual.estado === 'leido';

    if (estado === 'leido' && !estabaLeidoAntes) {
      const miembros = await prisma.clubMember.findMany({
        where: { clubId },
        include: { user: true },
      });

      await prisma.$transaction(
        miembros.map(miembro => {
          const oldLevel = miembro.user.level || 1;
          const { xp, level } = computeNewXpAndLevel(miembro.user, XP_REWARDS.COMPLETAR_LIBRO);
          
          if (level > oldLevel) {
            crearNotificacion(
              miembro.userId,
              'NIVEL_SUBIDO',
              '🎉 ¡Subiste de nivel!',
              `¡Felicidades! Ahora eres nivel ${level}. Ganaste ${XP_REWARDS.COMPLETAR_LIBRO} XP por completar un libro.`,
              { 
                oldLevel, 
                newLevel: level, 
                xp,
                xpGanado: XP_REWARDS.COMPLETAR_LIBRO
              }
            ).catch(err => console.error('[ERROR] Error al notificar nivel subido:', err));
          }
          
          return prisma.user.update({
            where: { id: miembro.userId },
            data: { xp, level },
          });
        })
      );
    }

    await prisma.clubBook.updateMany({
      where: { clubId, bookId },
      data: { estado },
    });

    const historialData = {
      userId: user.id,
      bookId,
      clubId,
      estado,
      fechaCambio: new Date(),
    };

    if (estado === 'leyendo') {
      historialData.fechaInicio = new Date();
    }

    if (estado === 'leido') {
      historialData.fechaFin = new Date();

      const entradaLeyendo = await prisma.readingHistory.findFirst({
        where: { userId: user.id, bookId, clubId, estado: 'leyendo' },
        orderBy: { fechaCambio: 'desc' },
      });

      if (entradaLeyendo) {
        historialData.fechaInicio = entradaLeyendo.fechaInicio;
      }
    }

    await prisma.readingHistory.create({ data: historialData });

    res.json({ success: true, message: "Estado actualizado, historial registrado y XP asignada (si correspondía)" });
  } catch (error) {
    console.error('[ERROR] Error al cambiar estado:', error);
    res.status(500).json({ success: false, message: "Error al actualizar estado" });
  }
};

/**
 * Busca libros en la API de Google Books
 * Ruta: GET /api/books/search
 */
const searchBooks = async (req, res) => {
  try {
    const { query } = req.query;
    if (!query) {
      return res.status(400).json({ success: false, message: "Query requerido" });
    }

    const apiUrl = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&maxResults=10`;
    const response = await fetch(apiUrl);
    
    if (!response.ok) {
      throw new Error('Error en la API de Google Books');
    }
    
    const data = await response.json();
    
    const books = data.items?.map(item => ({
      id: item.id,
      title: item.volumeInfo?.title || 'Sin título',
      author: item.volumeInfo?.authors?.join(', ') || 'Autor desconocido',
      portada: item.volumeInfo?.imageLinks?.thumbnail || null,
      categories: item.volumeInfo?.categories || []
    })) || [];

    res.json({ success: true, books });
  } catch (error) {
    console.error("[ERROR] Error al buscar libros:", error);
    res.status(500).json({ success: false, message: "Error al buscar libros", books: [] });
  }
};

/**
 * Obtiene todos los libros de la base de datos
 * Ruta: GET /api/books
 */
const getAllBooks = async (req, res) => {
  try {
    const books = await prisma.book.findMany();
    res.json({ success: true, books });
  } catch (error) {
    console.error("[ERROR] Error al obtener libros:", error);
    res.status(500).json({ success: false, message: "Error al obtener libros" });
  }
};

/**
 * Busca cursos de señasApp en Supabase
 * Ruta: GET /api/cursos/search
 */
const searchCursos = async (req, res) => {
  try {
    const { query } = req.query;
    
    const SUPABASE_URL = "https://apjepniceyfghladqqxg.supabase.co/rest/v1/get_modulos";
    const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFwamVwbmljZXlmZ2hsYWRxcXhnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc4NjE5NjcsImV4cCI6MjA3MzQzNzk2N30.gVnCO7ALvbF3Zol9k-R6k-CyPDh8-7KjJiqRuU5YVRk";

    const url = `${SUPABASE_URL}?select=*`;

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "apikey": SUPABASE_KEY,
        "Authorization": `Bearer ${SUPABASE_KEY}`,
        "Content-Type": "application/json"
      }
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error("[ERROR] Error Supabase:", response.status, errorText);
      throw new Error(`Error API externa: ${response.status}`);
    }
    
    const cursosRaw = await response.json();

    let cursosFiltrados = cursosRaw;
    
    if (query) {
      const queryLower = query.toLowerCase();
      cursosFiltrados = cursosRaw.filter(curso => {
        const titulo = curso.nombre || curso.titulo || curso.name || curso.descripcion || "";
        return titulo.toLowerCase().includes(queryLower);
      });
    }

    const cursosComoLibros = cursosFiltrados.map(curso => ({
      title: curso.nombre || curso.titulo || curso.modulo || "Curso sin título", 
      id_api: curso.id, 
      author: "señasApp", 
      portada:"../images/senas.png", 
      descripcion: curso.descripcion || "Curso de SeñasApp"
    }));

    res.json({ success: true, cursos: cursosComoLibros });

  } catch (error) {
    console.error("[ERROR] Error en searchCursos:", error.message);
    res.status(500).json({ success: false, message: "Error buscando cursos", cursos: [] });
  }
};

/**
 * Agrega un curso de señasApp como libro al club
 * Ruta: POST /api/club/:id/curso
 */
const agregarCursoComoLibro = async (req, res) => {
  const clubId = parseInt(req.params.id);
  const { title, id_api, username } = req.body; 
  
  const AUTHOR_DEFAULT = "señasApp";
  const PORTADA_DEFAULT = "/images/señas.png";

  try {
    const user = await prisma.user.findUnique({
      where: { username: username }
    });

    if (!user) {
      return res.status(404).json({ success: false, message: "Usuario no encontrado" });
    }

    const resultado = await prisma.$transaction(async (prisma) => {
      const nuevoLibro = await prisma.book.create({
        data: {
          title: title,
          id_api: typeof id_api === 'string' ? parseInt(id_api) : id_api,
          author: AUTHOR_DEFAULT, 
          portada: PORTADA_DEFAULT,
        }
      });

      const nuevoClubBook = await prisma.clubBook.create({
        data: {
          clubId: clubId,
          bookId: nuevoLibro.id,
          addedById: user.id,
          estado: 'por_leer'
        }
      });

      return { libro: nuevoLibro, clubBook: nuevoClubBook };
    });
    
    await otorgarXP(user.id, 'AGREGAR_LIBRO');
    
    res.json({ 
      success: true, 
      message: "Curso agregado exitosamente", 
      book: resultado.libro 
    });

  } catch (error) {
    console.error("[ERROR] Error guardando curso:", error);
    res.status(500).json({ success: false, error: "Error guardando curso en la base de datos" });
  }
};

module.exports = {
  addBookToClub,
  removeBookFromClub,
  changeBookStatus,
  getAllBooks,
  searchBooks,
  searchCursos,
  agregarCursoComoLibro
};