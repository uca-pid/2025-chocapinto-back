// routes/ranking.global.routes.js
const express = require('express');
const router = express.Router();
const { getGlobalRankingSameLogic } = require('../controllers/ranking.global.controller');

// GET /ranking/global
router.get('/ranking/global', getGlobalRankingSameLogic);

module.exports = router;