const prisma = require('../db');

const getGlobalRanking = async (req, res) => {
  try {
    const topN = Number(req.query.top) || 3;
    console.log('Obteniendo ranking global (top', topN, ')');

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
      avatar: u.avatar, // Incluir el avatar real del usuario
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
      avatar: u.avatar, // Usar el avatar real del usuario
    }));

    console.log(`Ranking global calculado: ${ranking.length} usuarios`);
    return res.json({ success: true, ranking });

  } catch (error) {
    console.error('Error al obtener ranking global:', error && (error.stack || error));

    return res.status(500).json({ success: false, message: 'Error al obtener ranking global' });
  }
};

module.exports = { getGlobalRanking };
