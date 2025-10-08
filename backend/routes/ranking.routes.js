// src/routes/ranking.routes.js
const express = require('express');
const router = express.Router();
const rankingController = require('../controllers/ranking.controller');

// Ruta para obtener ranking de usuarios más activos en un club
router.get('/club/:clubId/ranking', rankingController.getUsersRanking);

module.exports = router;