const prisma = require('../db');

/**
 * Obtiene el ranking global de usuarios por cantidad de clubes
 * Ruta: GET /api/ranking/global?top=N
 */
const getGlobalRanking = async (req, res) => {
  try {
    const topN = Number(req.query.top) || 3;

    const users = await prisma.user.findMany({
      select: {
        id: true,
        username: true,
        memberships: true,
        avatar: true,
      },
    });

    const usersWithCounts = users.map(u => ({
      id: u.id,
      username: u.username,
      clubsCount: Array.isArray(u.memberships) ? u.memberships.length : 0,
      avatar: u.avatar,
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
      avatar: u.avatar,
    }));

    return res.json({ success: true, ranking });

  } catch (error) {
    console.error('[ERROR] Error al obtener ranking global:', error);

    return res.status(500).json({ success: false, message: 'Error al obtener ranking global' });
  }
};

module.exports = { getGlobalRanking };
