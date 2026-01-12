// src/controllers/comment.controller.js
const prisma = require('../db');
const { otorgarXP } = require('../utils/XPRewards');

/**
 * Obtiene los comentarios de un libro en un club específico
 * Ruta: GET /api/club/:clubId/book/:bookId/comments
 */
const getComments = async (req, res) => {
  try {
    const clubId = Number(req.params.clubId);
    const bookId = Number(req.params.bookId);

    if (!clubId || !bookId) {
      return res.status(400).json({ success: false, message: "IDs inválidos" });
    }

    const clubBook = await prisma.clubBook.findFirst({
      where: { clubId, bookId }
    });

    if (!clubBook) {
      return res.json({ success: true, comments: [] });
    }

    const comments = await prisma.comment.findMany({
      where: { clubBookId: clubBook.id },
      include: { user: { select: { username: true } } },
      orderBy: { createdAt: 'desc' }
    });

    const formattedComments = comments.map(comment => ({
      id: comment.id,
      content: comment.content,
      texto: comment.content,
      username: comment.user.username,
      createdAt: comment.createdAt
    }));

    res.json({ success: true, comments: formattedComments });
  } catch (error) {
    console.error("[ERROR] Error al obtener comentarios:", error);
    res.status(500).json({ success: false, message: "Error al obtener comentarios" });
  }
};

/**
 * Obtiene comentarios (ruta legacy con orden de parámetros diferente)
 * Ruta: GET /comentario/book/:bookId/club/:clubId
 */
const getCommentsLegacy = async (req, res) => {
  try {
    const bookId = Number(req.params.bookId);
    const clubId = Number(req.params.clubId);

    if (!clubId || !bookId) {
      return res.status(400).json({ success: false, message: "IDs inválidos" });
    }

    const clubBook = await prisma.clubBook.findUnique({
      where: {
        clubId_bookId: { clubId, bookId }
      }
    });
    
    if (!clubBook) {
      return res.status(404).json({ success: false, message: "Libro no encontrado en este club" });
    }

    const comentarios = await prisma.comment.findMany({
      where: { clubBookId: clubBook.id },
      include: { 
        user: { 
          select: { 
            id: true, 
            username: true, 
            avatar: true 
          } 
        } 
      },
      orderBy: { createdAt: 'desc' }
    });

    const formattedComentarios = comentarios.map(c => ({
      id: c.id,
      content: c.content,
      userId: c.userId,
      createdAt: c.createdAt,
      user: {
        id: c.user.id,
        username: c.user.username,
        avatar: c.user.avatar
      }
    }));

    res.json({ success: true, comentarios: formattedComentarios });
  } catch (error) {
    console.error("[ERROR] Error al obtener comentarios (legacy):", error);
    res.status(500).json({ success: false, message: "Error al obtener comentarios" });
  }
};

/**
 * Crea un nuevo comentario en un libro del club
 * Ruta: POST /api/club/:clubId/book/:bookId/comments
 */
const createComment = async (req, res) => {
  try {
    const clubId = Number(req.params.clubId);
    const bookId = Number(req.params.bookId);
    const { texto, content, username } = req.body;

    const commentContent = content || texto;

    if (!commentContent || !username) {
      return res.status(400).json({ 
        success: false, 
        message: "Faltan datos requeridos: content/texto y username" 
      });
    }

    if (!clubId || !bookId) {
      return res.status(400).json({ success: false, message: "IDs inválidos" });
    }

    const user = await prisma.user.findUnique({ where: { username } });
    if (!user) {
      return res.status(404).json({ success: false, message: "Usuario no encontrado" });
    }

    const clubBook = await prisma.clubBook.findFirst({
      where: { clubId, bookId }
    });

    if (!clubBook) {
      return res.status(404).json({ success: false, message: "El libro no está en este club" });
    }

    const comentariosAnteriores = await prisma.comment.count({
      where: {
        userId: user.id,
        clubBookId: clubBook.id
      }
    });

    const esPrimerComentario = comentariosAnteriores === 0;

    const comment = await prisma.comment.create({
      data: {
        content: commentContent.trim(),
        userId: user.id,
        clubBookId: clubBook.id
      },
      include: { user: { select: { username: true } } }
    });

    if (esPrimerComentario) {
      await otorgarXP(user.id, 'PRIMER_COMENTARIO_LIBRO');
    } else {
      await otorgarXP(user.id, 'COMENTARIO_ADICIONAL');
    }

    res.json({
      success: true,
      comment: {
        id: comment.id,
        content: comment.content,
        texto: comment.content,
        username: comment.user.username,
        createdAt: comment.createdAt
      }
    });
  } catch (error) {
    console.error("[ERROR] Error al crear comentario:", error);
    res.status(500).json({ success: false, message: "Error al crear comentario" });
  }
};

/**
 * Crea un comentario (ruta legacy con body diferente)
 * Ruta: POST /comentario
 */
const createCommentLegacy = async (req, res) => {
  try {
    const { userId, bookId, clubId, content, texto } = req.body;

    const commentContent = content || texto;

    if (!commentContent || !userId || !bookId || !clubId) {
      return res.status(400).json({ 
        success: false, 
        message: "Faltan datos requeridos: userId, bookId, clubId y content/texto" 
      });
    }

    const user = await prisma.user.findUnique({ where: { id: Number(userId) } });
    if (!user) {
      return res.status(404).json({ success: false, message: "Usuario no encontrado" });
    }

    const clubBook = await prisma.clubBook.findFirst({
      where: { 
        clubId: Number(clubId), 
        bookId: Number(bookId) 
      }
    });

    if (!clubBook) {
      return res.status(404).json({ success: false, message: "El libro no está en este club" });
    }

    const comentariosAnteriores = await prisma.comment.count({
      where: {
        userId: Number(userId),
        clubBookId: clubBook.id
      }
    });

    const esPrimerComentario = comentariosAnteriores === 0;

    const comment = await prisma.comment.create({
      data: {
        content: commentContent.trim(),
        userId: Number(userId),
        clubBookId: clubBook.id
      },
      include: { user: { select: { username: true } } }
    });

    if (esPrimerComentario) {
      await otorgarXP(Number(userId), 'PRIMER_COMENTARIO_LIBRO');
    } else {
      await otorgarXP(Number(userId), 'COMENTARIO_ADICIONAL');
    }

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
    console.error("[ERROR] Error al crear comentario (legacy):", error);
    res.status(500).json({ success: false, message: "Error al crear comentario" });
  }
};

/**
 * Elimina un comentario por ID
 * Ruta: DELETE /api/comments/:id
 */
const deleteComment = async (req, res) => {
  try {
    const comentarioId = Number(req.params.id);
    
    if (!comentarioId) {
      return res.status(400).json({ success: false, message: "ID de comentario inválido" });
    }

    const comentario = await prisma.comment.findUnique({ where: { id: comentarioId } });
    
    if (!comentario) {
      return res.status(404).json({ success: false, message: "Comentario no encontrado" });
    }
    // ✅ VALIDACIÓN: Solo el autor o un admin puede eliminar
    if (comentario.userId !== req.user.userId && req.user.role !== 'admin') {
      return res.status(403).json({ 
        success: false, 
        message: 'No puedes eliminar comentarios de otros usuarios' 
      });
    }
    await prisma.comment.delete({ where: { id: comentarioId } });
    
    res.json({ success: true, message: "Comentario eliminado" });
  } catch (error) {
    console.error("[ERROR] Error al eliminar comentario:", error);
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