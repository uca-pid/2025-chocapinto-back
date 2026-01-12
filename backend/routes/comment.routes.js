// backend/routes/comment.routes.js
const express = require('express');
const router = express.Router();
const commentController = require('../controllers/comment.controller');
const { authenticateUser } = require('../middleware/userAuth.middleware');

// Rutas públicas
router.get('/comentario/book/:bookId/club/:clubId', commentController.getCommentsLegacy);

// Rutas protegidas (requieren autenticación)
router.post('/comentario', authenticateUser, commentController.createCommentLegacy);
router.delete('/comentario/:id', authenticateUser, commentController.deleteComment);

module.exports = router;