const router = require('express').Router();
const { getGlobalRanking } = require('../controllers/rankingGlobal.controller');

router.get('/global/ranking', getGlobalRanking);

module.exports = router;
