// backend/routes/book.routes.js
const express = require('express');
const router = express.Router();
const bookController = require('../controllers/book.controller');
const { authenticateUser } = require('../middleware/userAuth.middleware');

// Rutas públicas
router.get('/searchCursos', bookController.searchCursos); 
router.get('/search', bookController.searchBooks);
router.get('/', bookController.getAllBooks); 

// Rutas protegidas (requieren autenticación)
router.post('/addBook', authenticateUser, bookController.addBookToClub); 
router.post('/club/:id/addBook', authenticateUser, bookController.addBookToClub);
router.post('/club/:id/agregarCursoComoLibro', authenticateUser, bookController.agregarCursoComoLibro);
router.post('/deleteBook', authenticateUser, bookController.removeBookFromClub); 
router.delete('/club/:id/deleteBook', authenticateUser, bookController.removeBookFromClub);
router.delete('/club/:id/deleteBook/:bookId', authenticateUser, bookController.removeBookFromClub);
router.put('/club/:clubId/book/:bookId/estado', authenticateUser, bookController.changeBookStatus);

module.exports = router;