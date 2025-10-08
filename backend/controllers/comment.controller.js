// src/controllers/comment.controller.js
const prisma = require('../db');
const { validateRequiredFields } = require('../utils/validateFields');

const getComments = async (req, res) => {
  try {
    const clubId = Number(req.params.clubId);
    const bookId = Number(req.params.bookId);

    console.log("Obteniendo comentarios para club:", clubId, "y libro:", bookId);

    if (!clubId || !bookId) {
      console.log("IDs inválidos:", { clubId, bookId });
      return res.status(400).json({ success: false, message: "IDs inválidos" });
    }

    // Primero buscar el ClubBook
    const clubBook = await prisma.clubBook.findFirst({
      where: {
        clubId: clubId,
        bookId: bookId
      }
    });

    console.log("ClubBook encontrado:", clubBook);

    if (!clubBook) {
      console.log("ClubBook no encontrado para club:", clubId, "y libro:", bookId);
      // Retornar array vacío en lugar de error para permitir que se muestren 0 comentarios
      return res.json({ success: true, comments: [] });
    }

    // Buscar comentarios usando el clubBookId
    const comments = await prisma.comment.findMany({
      where: { clubBookId: clubBook.id },
      include: { user: { select: { username: true } } },
      orderBy: { createdAt: 'desc' }
    });

    console.log("Comentarios encontrados:", comments.length);

    const formattedComments = comments.map(comment => ({
      id: comment.id,
      content: comment.content, // Usar 'content' según el schema
      texto: comment.content,   // Mantener 'texto' para compatibilidad con frontend
      username: comment.user.username,
      createdAt: comment.createdAt
    }));

    res.json({ success: true, comments: formattedComments });
  } catch (error) {
    console.error("Error al obtener comentarios:", error);
    res.status(500).json({ success: false, message: "Error al obtener comentarios" });
  }
};

// Función legacy para obtener comentarios con parámetros en orden diferente
const getCommentsLegacy = async (req, res) => {
  try {
    // En la ruta legacy: /comentario/book/:bookId/club/:clubId
    const bookId = Number(req.params.bookId);
    const clubId = Number(req.params.clubId);

    console.log("Obteniendo comentarios legacy para club:", clubId, "y libro:", bookId);

    if (!clubId || !bookId) {
      console.log("IDs inválidos:", { clubId, bookId });
      return res.status(400).json({ success: false, message: "IDs inválidos" });
    }

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
};

const createComment = async (req, res) => {
  try {
    const clubId = Number(req.params.clubId);
    const bookId = Number(req.params.bookId);
    const { texto, content, username } = req.body;

    console.log("Creando comentario:", { clubId, bookId, texto, content, username });

    // El contenido puede venir como 'texto' o 'content'
    const commentContent = content || texto;

    if (!commentContent || !username) {
      return res.status(400).json({ success: false, message: "Faltan datos requeridos: content/texto y username" });
    }

    if (!clubId || !bookId) {
      return res.status(400).json({ success: false, message: "IDs inválidos" });
    }

    // Verificar usuario
    const user = await prisma.user.findUnique({ where: { username } });
    if (!user) {
      return res.status(404).json({ success: false, message: "Usuario no encontrado" });
    }

    // Verificar que existe la relación ClubBook
    const clubBook = await prisma.clubBook.findFirst({
      where: { clubId, bookId }
    });

    if (!clubBook) {
      return res.status(404).json({ success: false, message: "El libro no está en este club" });
    }

    // Crear comentario usando el modelo Comment correcto
    const comment = await prisma.comment.create({
      data: {
        content: commentContent.trim(),
        userId: user.id,
        clubBookId: clubBook.id  // Usar clubBookId según el schema
      },
      include: { user: { select: { username: true } } }
    });

    res.json({
      success: true,
      comment: {
        id: comment.id,
        content: comment.content,
        texto: comment.content, // Para compatibilidad
        username: comment.user.username,
        createdAt: comment.createdAt
      }
    });
  } catch (error) {
    console.error("Error al crear comentario:", error);
    res.status(500).json({ success: false, message: "Error al crear comentario" });
  }
};
// Función legacy para manejar la ruta POST /comentario
const createCommentLegacy = async (req, res) => {
  try {
    const { userId, bookId, clubId, content, texto } = req.body;

    console.log("Creando comentario legacy:", req.body);

    // El contenido puede venir como 'content' o 'texto'
    const commentContent = content || texto;

    if (!commentContent || !userId || !bookId || !clubId) {
      return res.status(400).json({ 
        success: false, 
        message: "Faltan datos requeridos: userId, bookId, clubId y content/texto" 
      });
    }

    // Verificar usuario por ID
    const user = await prisma.user.findUnique({ where: { id: Number(userId) } });
    if (!user) {
      return res.status(404).json({ success: false, message: "Usuario no encontrado" });
    }

    // Verificar que existe la relación ClubBook
    const clubBook = await prisma.clubBook.findFirst({
      where: { 
        clubId: Number(clubId), 
        bookId: Number(bookId) 
      }
    });

    if (!clubBook) {
      return res.status(404).json({ success: false, message: "El libro no está en este club" });
    }

    // Crear comentario usando el modelo Comment
    const comment = await prisma.comment.create({
      data: {
        content: commentContent.trim(),
        userId: Number(userId),
        clubBookId: clubBook.id
      },
      include: { user: { select: { username: true } } }
    });

    res.json({
      success: true,
      comentario: {
        id: comment.id,
        content: comment.content,
        username: comment.user.username,
        createdAt: comment.createdAt
      }
    });
  } catch (error) {
    console.error("Error al crear comentario legacy:", error);
    res.status(500).json({ success: false, message: "Error al crear comentario" });
  }
};

const deleteComment= async (req, res) => {
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
};

module.exports = {
  getComments,
  getCommentsLegacy,
  createComment,
  createCommentLegacy,
  deleteComment
};