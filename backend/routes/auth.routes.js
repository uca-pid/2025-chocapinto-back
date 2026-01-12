// src/routes/auth.routes.js
const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');

// Rutas de autenticación
router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/changePassword', authController.changePassword);
router.post('/forgot-password', authController.requestPasswordReset);
router.post('/reset-password', authController.resetPassword);


module.exports = router; 