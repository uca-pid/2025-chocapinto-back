// src/routes/comment.routes.js
const express = require('express');
const router = express.Router();
const commentController = require('../controllers/comment.controller');



// Rutas legacy para compatibilidad
router.get('/comentario/book/:bookId/club/:clubId', commentController.getCommentsLegacy);
router.post('/comentario', commentController.createCommentLegacy);
router.delete('/comentario/:id', commentController.deleteComment);

module.exports = router;