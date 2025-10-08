// src/routes/user.routes.js
const express = require('express');
const router = express.Router();
const userController = require('../controllers/user.controller');

// Rutas de usuario
router.get('/user/:idOrUsername', userController.getUserByIdOrUsername);
router.put('/updateUser', userController.updateUser);
router.post('/deleteUser', userController.deleteUser);

module.exports = router;