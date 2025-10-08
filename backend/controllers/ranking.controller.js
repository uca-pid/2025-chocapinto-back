// src/controllers/ranking.controller.js
const prisma = require('../db');

const getUsersRanking = async (req, res) => {
  try {
    const clubId = Number(req.params.clubId);

    if (!clubId) {
      return res.status(400).json({ success: false, message: "ID de club inválido" });
    }

    console.log("Obteniendo ranking para club:", clubId);

    // Verificar que el club existe
    const club = await prisma.club.findUnique({
      where: { id: clubId },
      include: { members: true }
    });

    if (!club) {
      return res.status(404).json({ success: false, message: "Club no encontrado" });
    }

    // Obtener estadísticas de usuarios activos en el club
    const usersStats = await Promise.all(
      club.members.map(async (user) => {
        // Contar comentarios del usuario en libros de este club
        const commentsCount = await prisma.comment.count({
          where: {
            userId: user.id,
            clubBook: {
              clubId: clubId
            }
          }
        });

        // Contar libros agregados por el usuario a este club
        const booksAddedCount = await prisma.clubBook.count({
          where: {
            addedById: user.id,
            clubId: clubId
          }
        });

        // Calcular score total (comentarios + libros agregados * 2)
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

    // Ordenar por score total (descendente)
    const ranking = usersStats
      .filter(user => user.totalScore > 0) // Solo usuarios con actividad
      .sort((a, b) => b.totalScore - a.totalScore)
      .slice(0, 10); // Top 10

    console.log("Ranking calculado:", ranking.length, "usuarios activos");

    res.json({
      success: true,
      club: {
        id: club.id,
        name: club.name
      },
      ranking
    });
  } catch (error) {
    console.error("Error al obtener ranking:", error);
    res.status(500).json({ success: false, message: "Error al obtener ranking" });
  }
};

module.exports = {
  getUsersRanking
};