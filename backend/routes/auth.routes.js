// src/routes/auth.routes.js
const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');

// Rutas de autenticación
router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/changePassword', authController.changePassword);

module.exports = router; 