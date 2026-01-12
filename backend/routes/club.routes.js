// src/routes/club.routes.js
const express = require('express');
const router = express.Router();
const clubController = require('../controllers/club.controller');
const { authenticateUser, authorizeRoles } = require('../middleware/userAuth.middleware');

// Rutas públicas (sin autenticación)
router.get('/clubs', clubController.getAllClubs);
router.get('/club/:id', clubController.getClubById);

// Rutas protegidas (requieren autenticación)
router.post('/createClub', authenticateUser, clubController.createClub);
router.delete('/deleteClub/:id', authenticateUser, authorizeRoles('admin', 'moderator'), clubController.deleteClub);
router.post('/clubSolicitud', authenticateUser, clubController.joinClub);
router.put('/club/:clubId/solicitud/:solicitudId', authenticateUser, clubController.manageMembershipRequest);
router.delete('/club/:clubId/removeMember/:userId', authenticateUser, clubController.removeMember);
router.put('/club/:clubId/change-role/:userId', authenticateUser, authorizeRoles('admin', 'moderator'), clubController.changeUserRole);

module.exports = router;