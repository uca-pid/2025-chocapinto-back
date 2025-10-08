// src/routes/categoria.routes.js
const express = require('express');
const router = express.Router();
const categoriaController = require('../controllers/categoria.controller');

// Rutas de categorías
router.get('/categorias', categoriaController.getCategorias);
router.post('/categorias', categoriaController.createCategoria);
router.delete('/categorias/:id', categoriaController.deleteCategoria);
router.put('/categorias/:id', categoriaController.updateCategoria);

module.exports = router;