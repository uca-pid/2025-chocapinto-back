const prisma = require('../db');

/**
 * Obtiene el ranking de usuarios de un club
 * Ruta: GET /api/club/:clubId/ranking
 */
const getUsersRanking = async (req, res) => {
  try {
    const clubId = Number(req.params.clubId);

    if (!clubId) {
      return res.status(400).json({ success: false, message: "ID de club inválido" });
    }

    const club = await prisma.club.findUnique({
      where: { id: clubId },
      include: { 
        memberships: {
          include: {
            user: true
          }
        }
      }
    });

    if (!club) {
      return res.status(404).json({ success: false, message: "Club no encontrado" });
    }

    const usersStats = await Promise.all(
      club.memberships.map(async (membership) => {
        const user = membership.user;
        const commentsCount = await prisma.comment.count({
          where: {
            userId: user.id,
            clubBook: {
              clubId: clubId
            }
          }
        });

        const booksAddedCount = await prisma.clubBook.count({
          where: {
            addedById: user.id,
            clubId: clubId
          }
        });

        const totalScore = commentsCount + (booksAddedCount * 2);

        return {
          id: user.id,
          username: user.username,
          commentsCount,
          booksAddedCount,
          totalScore
        };
      })
    );

    const ranking = usersStats
      .filter(user => user.totalScore > 0)
      .sort((a, b) => b.totalScore - a.totalScore)
      .slice(0, 10);

    res.json({
      success: true,
      club: {
        id: club.id,
        name: club.name
      },
      ranking
    });
  } catch (error) {
    console.error("[ERROR] Error al obtener ranking:", error);
    res.status(500).json({ success: false, message: "Error al obtener ranking" });
  }
};

module.exports = {
  getUsersRanking
};