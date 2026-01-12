// src/routes/book.routes.js
const express = require('express');
const router = express.Router();
const bookController = require('../controllers/book.controller');

// --- 1. RUTAS ESPECÍFICAS (SIEMPRE PRIMERO) ---

// CORREGIDO: Quitamos '/books' porque ya viene del server.js
router.get('/searchCursos', bookController.searchCursos); 
router.get('/search', bookController.searchBooks);

// --- 2. RUTAS GENERALES Y DINÁMICAS ---

// Rutas de libros
router.post('/addBook', bookController.addBookToClub); 
router.post('/club/:id/addBook', bookController.addBookToClub);
router.post('/club/:id/agregarCursoComoLibro', bookController.agregarCursoComoLibro);

// Rutas para eliminar
router.post('/deleteBook', bookController.removeBookFromClub); 
router.delete('/club/:id/deleteBook', bookController.removeBookFromClub);
router.delete('/club/:id/deleteBook/:bookId', bookController.removeBookFromClub);

router.put('/club/:clubId/book/:bookId/estado', bookController.changeBookStatus);

// CORREGIDO: Esta ruta '/' equivale a '/api/books'
router.get('/', bookController.getAllBooks); 

module.exports = router;