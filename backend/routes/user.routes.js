// src/routes/user.routes.js
const express = require('express');
const router = express.Router();
const userController = require('../controllers/user.controller');
const { authenticateUser } = require('../middleware/userAuth.middleware');

// Rutas públicas
router.get('/user/:idOrUsername', userController.getUserByIdOrUsername);

// Rutas protegidas (requieren autenticación)
router.put('/updateUser', authenticateUser, userController.updateUser);
router.post('/deleteUser', authenticateUser, userController.deleteUser);
router.get('/user/:username/clubs', authenticateUser, userController.getMyClubs); 
router.put('/users/:userId/update-avatar', authenticateUser, userController.updateAvatarSelection); 

module.exports = router;