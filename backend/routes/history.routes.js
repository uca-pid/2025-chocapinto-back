// src/routes/history.routes.js
const express = require('express');
const router = express.Router();
const historyController = require('../controllers/history.controller');

// Rutas de historial
router.get('/club/:clubId/reading-history', historyController.getClubHistory);
router.get('/club/:clubId/reading-stats', historyController.getClubStats);

module.exports = router;