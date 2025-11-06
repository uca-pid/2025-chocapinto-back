// src/controllers/rankingGlobal.controller.js
const prisma = require('../db');

const getGlobalRanking = async (req, res) => {
  try {
    const topN = Number(req.query.top) || 3;
    console.log('Obteniendo ranking global (top', topN, ')');

    // Traer usuarios con los clubs (usamos select — no usar include junto a select)
    const users = await prisma.user.findMany({
      select: {
        id: true,
        username: true,
        clubs: true, // trae el array clubs; si querés solo ids: clubs: { select: { id: true } }
      },
    });

    const usersWithCounts = users.map(u => ({
      id: u.id,
      username: u.username,
      clubsCount: Array.isArray(u.clubs) ? u.clubs.length : 0,
    }));

    const top = usersWithCounts
      .filter(u => u.clubsCount > 0)
      .sort((a, b) => b.clubsCount - a.clubsCount)
      .slice(0, topN);

    const ranking = top.map((u, i) => ({
      puesto: i + 1,
      id: u.id,
      username: u.username,
      clubsCount: u.clubsCount,
      avatarURL: `/images/avatars/default-${(u.id % 5) + 1}.png`,
    }));

    console.log(`Ranking global calculado: ${ranking.length} usuarios`);
    return res.json({ success: true, ranking });
  } catch (error) {
    console.error('Error al obtener ranking global:', error && (error.stack || error));

    if (process.env.NODE_ENV === 'development' || process.env.DEBUG === 'true') {
      return res.status(500).json({
        success: false,
        message: error.message,
        stack: error.stack,
      });
    }

    return res.status(500).json({ success: false, message: 'Error al obtener ranking global' });
  }
};

module.exports = { getGlobalRanking };
