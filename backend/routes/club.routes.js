// src/routes/club.routes.js
const express = require('express');
const router = express.Router();
const clubController = require('../controllers/club.controller');

// Rutas de club
router.post('/createClub', clubController.createClub);
router.delete('/deleteClub/:id', clubController.deleteClub);
router.get('/clubs', clubController.getAllClubs);
router.get('/club/:id', clubController.getClubById);
router.post('/clubSolicitud', clubController.joinClub);
router.put('/club/:clubId/solicitud/:solicitudId', clubController.manageMembershipRequest);
router.delete('/club/:clubId/removeMember/:userId', clubController.removeMember);

// Ruta de debug para ver usuarios con roles
router.get('/debug/club/:clubId/users-roles', clubController.debugUsersWithRoles);

// Ruta para cambiar rol de usuario en club
router.put('/club/:clubId/change-role/:userId', clubController.changeUserRole);

module.exports = router;