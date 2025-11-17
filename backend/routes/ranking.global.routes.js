const express = require('express');
const router = express.Router();
const { getGlobalRanking } = require('../controllers/ranking.global.controller');

router.get('/api/global/ranking', getGlobalRanking);

module.exports = router;