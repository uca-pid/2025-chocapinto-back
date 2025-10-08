// src/routes/book.routes.js
const express = require('express');
const router = express.Router();
const bookController = require('../controllers/book.controller');

// Rutas de libros
router.post('/addBook', bookController.addBookToClub); // Ruta legacy
router.post('/club/:id/addBook', bookController.addBookToClub);

// Rutas para eliminar libros - múltiples formatos
router.post('/deleteBook', bookController.removeBookFromClub); // Ruta legacy
router.delete('/club/:id/deleteBook', bookController.removeBookFromClub);
router.delete('/club/:id/deleteBook/:bookId', bookController.removeBookFromClub);

router.put('/club/:clubId/book/:bookId/estado', bookController.changeBookStatus);
router.get('/books/search', bookController.searchBooks);
router.get('/books', bookController.getAllBooks);


module.exports = router;