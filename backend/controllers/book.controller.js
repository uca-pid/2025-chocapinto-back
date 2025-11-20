// src/controllers/book.controller.js
const prisma = require('../db');
const { validateRequiredFields } = require('../utils/validateFields');
const { computeNewXpAndLevel, XP_PER_BOOK_FINISHED } = require('../utils/xpSystem');

const addBookToClub = async (req, res) => {
  try {
    const { title, author, portada, thumbnail, id_api, username, categorias } = req.body;
    
    // El clubId puede venir del body o de los params de la URL
    const clubId = req.body.clubId || req.params.id;

    console.log("Datos recibidos en addBookToClub:", req.body);
    console.log("Club ID desde params:", req.params.id);
    console.log("Club ID final:", clubId);

    // Solo title, clubId y username son realmente requeridos
    if (!title || !clubId || !username) {
      return res.status(400).json({ 
        success: false, 
        message: "Faltan datos requeridos: title, clubId y username son obligatorios" 
      });
    }

    // Obtener usuario
    const user = await prisma.user.findUnique({ where: { username } });
    if (!user) {
      return res.status(404).json({ success: false, message: "Usuario no encontrado" });
    }

    // Verificar que es miembro del club
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

    // Normalizar datos
    const cleanAuthor = author && author !== "null" && author.trim() !== "" ? author.trim() : null;
    const cleanIdApi = id_api && id_api !== "null" && id_api !== "" ? id_api : null;
    // La portada puede venir como 'portada' o 'thumbnail'
    const cleanPortada = (portada || thumbnail) && (portada || thumbnail) !== "null" && (portada || thumbnail).trim() !== "" 
      ? (portada || thumbnail).trim() 
      : null;

    // Buscar o crear el libro
    let book = await prisma.book.findFirst({
      where: {
        OR: [
          // Buscar por ID de API si existe
          ...(cleanIdApi ? [{ id_api: cleanIdApi }] : []),
          // Buscar por título y autor
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
      // Si el libro existe pero no tiene portada y ahora sí la enviamos, actualizarla
      if (!book.portada && cleanPortada) {
        book = await prisma.book.update({
          where: { id: book.id },
          data: { portada: cleanPortada }
        });
      }
    }

    // Verificar si ya está en el club
    const existingClubBook = await prisma.clubBook.findFirst({
      where: { clubId: Number(clubId), bookId: book.id }
    });

    if (existingClubBook) {
      return res.status(400).json({ success: false, message: "El libro ya está en el club" });
    }

    // Agregar libro al club
    await prisma.clubBook.create({
      data: {
        clubId: Number(clubId),
        bookId: book.id,
        addedById: user.id,
        estado: "por_leer"
      }
    });

    // Procesar categorías si existen
    if (categorias && Array.isArray(categorias) && categorias.length > 0) {
      console.log("Categorías recibidas:", categorias);
      
      const categoriasIds = [];
      
      for (const categoria of categorias) {
        // Verificar si es un ID numérico o un nombre
        if (typeof categoria === 'number' || !isNaN(Number(categoria))) {
          // Es un ID de categoría existente
          const categoryId = Number(categoria);
          const existingCategory = await prisma.categoria.findUnique({
            where: { id: categoryId }
          });
          
          if (existingCategory) {
            categoriasIds.push({ id: categoryId });
          }
        } else if (typeof categoria === 'string' && categoria.trim() !== '') {
          // Es un nombre de categoría, buscar si existe
          let cat = await prisma.categoria.findFirst({
            where: { nombre: categoria.trim() }
          });

          if (!cat) {
            // Solo crear si no es una categoría predeterminada mal escrita
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

      // Conectar todas las categorías válidas al libro
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

    // Obtener el libro completo con categorías para la respuesta
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
    console.error("Error al agregar libro:", error);
    res.status(500).json({ success: false, message: "Error interno del servidor" });
  }
};

const removeBookFromClub = async (req, res) => {
  try {
    // Los datos pueden venir del body o de los params de la URL
    const clubId = req.body.clubId || req.params.id;
    const bookId = req.body.bookId || req.params.bookId;
    const username = req.body.username;

    console.log("Datos para eliminar libro:", { clubId, bookId, username });

    if (!clubId || !bookId || !username) {
      return res.status(400).json({ 
        success: false, 
        message: "Faltan datos requeridos: clubId, bookId y username son obligatorios" 
      });
    }

    // Verificar usuario
    const user = await prisma.user.findUnique({ where: { username } });
    if (!user) {
      return res.status(404).json({ success: false, message: "Usuario no encontrado" });
    }

    // Verificar que el club existe y los permisos
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

    // Usar transacción para mantener consistencia de datos
    await prisma.$transaction(async (tx) => {
      // Primero, obtener el ClubBook para tener el ID correcto
      const clubBook = await tx.clubBook.findFirst({
        where: {
          clubId: Number(clubId),
          bookId: Number(bookId)
        }
      });

      if (!clubBook) {
        throw new Error("El libro no está en este club");
      }

      // Eliminar comentarios relacionados con este ClubBook
      try {
        await tx.comment.deleteMany({
          where: { 
            clubBookId: clubBook.id
          }
        });
      } catch (commentError) {
        console.log("No hay comentarios para eliminar o tabla comment no existe:", commentError.message);
        // Intentar con la tabla comentario si comment no existe
        try {
          await tx.comentario.deleteMany({
            where: { 
              clubId: Number(clubId),
              bookId: Number(bookId)
            }
          });
        } catch (comentarioError) {
          console.log("Tabla comentario tampoco existe:", comentarioError.message);
        }
      }

      // Eliminar el historial de lectura relacionado
      try {
        await tx.readingHistory.deleteMany({
          where: {
            clubId: Number(clubId),
            bookId: Number(bookId)
          }
        });
      } catch (historyError) {
        console.log("No hay historial para eliminar:", historyError.message);
      }

      // Eliminar de ClubBook
      await tx.clubBook.delete({
        where: { id: clubBook.id }
      });

      // Verificar si el libro está en otros clubes
      const otherClubBooks = await tx.clubBook.findFirst({
        where: { bookId: Number(bookId) }
      });

      // Si no está en ningún club, eliminarlo completamente
      if (!otherClubBooks) {
        await tx.book.delete({
          where: { id: Number(bookId) }
        });
        console.log("Libro eliminado completamente de la base de datos");
      } else {
        console.log("Libro mantenido porque está en otros clubes");
      }
    });

    res.json({ success: true, message: "Libro eliminado del club" });
  } catch (error) {
    console.error("Error al eliminar libro:", error);
    res.status(500).json({ success: false, message: "Error interno del servidor" });
  }
};

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

    // Obtener usuario que hace el cambio
    const user = await prisma.user.findUnique({ where: { username } });
    if (!user) {
      return res.status(404).json({ success: false, message: "Usuario no encontrado" });
    }

    // Verificar que el club exista y que el usuario sea miembro
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

    // Obtener estado previo del libro en el club
    const clubBookActual = await prisma.clubBook.findFirst({
      where: { clubId, bookId },
    });

    if (!clubBookActual) {
      return res.status(404).json({ success: false, message: "Libro no encontrado en este club" });
    }

    const estabaLeidoAntes = clubBookActual.estado === 'leido';

    // Si pasa a "leido" y antes NO estaba en "leido",
    // dar XP a todos los miembros del club
    if (estado === 'leido' && !estabaLeidoAntes) {
      const miembros = await prisma.clubMember.findMany({
        where: { clubId },
        include: { user: true },
      });

      // Actualizamos XP y nivel de todos en una transacción
      await prisma.$transaction(
        miembros.map(miembro => {
          const { xp, level } = computeNewXpAndLevel(miembro.user, XP_PER_BOOK_FINISHED);
          return prisma.user.update({
            where: { id: miembro.userId },
            data: { xp, level },
          });
        })
      );
    }

    // Actualizar estado en ClubBook (estado del libro en el club)
    await prisma.clubBook.updateMany({
      where: { clubId, bookId },
      data: { estado },
    });

    // Registrar en historial para el usuario que dispara el cambio
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

      // Buscar la última entrada "leyendo" de ese usuario/libro/club
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
    console.error('Error al cambiar estado:', error);
    res.status(500).json({ success: false, message: "Error al actualizar estado" });
  }
};


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
    console.error("Error al buscar libros:", error);
    res.status(500).json({ success: false, message: "Error al buscar libros", books: [] });
  }
};

const getAllBooks = async (req, res) => {
  try {
    const books = await prisma.book.findMany();
    res.json({ success: true, books });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error al obtener libros" });
  }
};

const searchCursos = async (req, res) => {
    try {
        const { query } = req.query;
        
        console.log("=== SEARCH CURSOS ===");
        console.log("Query recibida:", query);
        
        if (!query) {
            return res.status(400).json({ success: false, message: "Query requerido" });
        }

        // 1. Petición a la API falsa (json-server)
        // Primero intentamos obtener todos los cursos y filtrar localmente
        let apiUrl = `http://localhost:3001/cursos`;
        console.log("URL a consultar:", apiUrl);
        
        const response = await fetch(apiUrl);
        console.log("Respuesta status:", response.status, response.statusText);

        if (!response.ok) {
            console.log("Error en response:", response.status, response.statusText);
            throw new Error(`Error en la API de cursos: ${response.status} ${response.statusText}`);
        }
        
        const todosCursos = await response.json();
        console.log("Todos los cursos obtenidos:", todosCursos);
        
        // Filtrar localmente por coincidencias en el nombre
        const cursosRaw = todosCursos.filter(curso => 
            curso.nombre_curso.toLowerCase().includes(query.toLowerCase())
        );
        console.log("Cursos filtrados:", cursosRaw);        // 2. MAPEO: Disfrazar los cursos de libros
        // Esto hace que tu frontend no se rompa
        const cursosComoLibros = cursosRaw.map(curso => ({
            title: curso.nombre_curso,        // Mapeamos nombre -> title
            author: "señasApp",
            portada: ""
,            id_api: curso.id_externo,         // ID externo para guardarlo despues

            descripcion: curso.descripcion || "Curso importado"
        }));

        console.log("Cursos transformados:", cursosComoLibros);

        // 3. Devolvemos los datos ya "disfrazados"
        res.json({ success: true, cursos: cursosComoLibros });

    } catch (error) {
        console.error("Error completo al buscar cursos:", error);
        res.status(500).json({ success: false, message: "Error al buscar cursos: " + error.message, cursos: [] });
    }
};
const agregarCursoComoLibro = async (req, res) => {
    // 1. Obtener datos de la URL y del Body
    const clubId = parseInt(req.params.id); // Viene de /club/:id/...
    const { title, id_api, username } = req.body; 
    
    // Valores por defecto (Hardcodeados)
    const AUTHOR_DEFAULT = "FinanzaApp";
    const PORTADA_DEFAULT = "https://placehold.co/150"; // Imagen genérica

    try {
        // 2. Buscar al usuario que está agregando el curso
        // Necesitamos su ID para el campo 'addedById'
        const user = await prisma.user.findUnique({
            where: { username: username }
        });

        if (!user) {
            return res.status(404).json({ success: false, message: "Usuario no encontrado" });
        }

        // 3. Crear el Libro y Vincularlo al Club (Transacción)
        // Usamos transaction para que si falla uno, no se cree nada.
        const resultado = await prisma.$transaction(async (prisma) => {
            
            // A. Crear el "Libro" (que en realidad es el curso)
            const nuevoLibro = await prisma.book.create({
                data: {
                    title: title,
                    id_api: typeof id_api === 'string' ? parseInt(id_api) : id_api, // Asegurar que sea Int
                    author: AUTHOR_DEFAULT, 
                    portada: PORTADA_DEFAULT,
                }
            });

            // B. Vincularlo al Club (Crear ClubBook)
            const nuevoClubBook = await prisma.clubBook.create({
                data: {
                    clubId: clubId,
                    bookId: nuevoLibro.id,
                    addedById: user.id,
                    estado: 'por_leer' // Estado inicial por defecto
                }
            });

            return { libro: nuevoLibro, clubBook: nuevoClubBook };
        });
        
        console.log(`✅ Curso agregado como libro: ${title}`);
        
        res.json({ 
            success: true, 
            message: "Curso agregado exitosamente", 
            book: resultado.libro 
        });

    } catch (error) {
        console.error("Error guardando curso:", error);
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