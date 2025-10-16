// controllers/ranking.global.controller.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * GET /ranking/global
 * Lógica: misma que el ranking por club, pero agregada globalmente:
 * - commentsCount: cantidad de comentarios del usuario (solo los que pertenecen a un ClubBook)
 * - booksAddedCount: cantidad de libros agregados por el usuario (ClubBook.addedById)
 * Orden: commentsCount DESC, luego booksAddedCount DESC.
 * Limita a top 10.
 */
exports.getGlobalRankingSameLogic = async (req, res) => {
  try {
    // 1) Comentarios por usuario (solo aquellos asociados a un ClubBook)
    const byComments = await prisma.comment.groupBy({
      by: ['userId'],
      where: { clubBookId: { not: null } },
      _count: { _all: true },
    });

    // 2) Libros agregados por usuario
    let byBooks = [];
    try {
      byBooks = await prisma.clubBook.groupBy({
        by: ['addedById'],
        _count: { _all: true },
      });
    } catch (_) {
      // Si no existe el modelo/columna en tu esquema actual, dejamos booksAddedCount en 0
      byBooks = [];
    }

    // 3) Combinar métricas por usuario
    const agg = new Map(); // userId -> { commentsCount, booksAddedCount }
    const ensure = (id) => {
      if (!agg.has(id)) agg.set(id, { commentsCount: 0, booksAddedCount: 0 });
      return agg.get(id);
    };

    for (const g of byComments) {
      const s = ensure(g.userId);
      s.commentsCount = g._count._all;
    }

    for (const g of byBooks) {
      const userId = g.addedById;
      if (userId == null) continue;
      const s = ensure(userId);
      s.booksAddedCount = g._count._all;
    }

    // 4) Orden: comments desc, luego booksAdded desc; limitar a top 10
    const merged = [...agg.entries()]
      .map(([userId, v]) => ({ userId, ...v }))
      .sort((a, b) => {
        if (b.commentsCount !== a.commentsCount) return b.commentsCount - a.commentsCount;
        return b.booksAddedCount - a.booksAddedCount;
      })
      .slice(0, 10);

    // 5) Adjuntar usernames
    const users = await prisma.user.findMany({
      where: { id: { in: merged.map(m => m.userId).filter(Boolean) } },
      select: { id: true, username: true },
    });
    const nameById = new Map(users.map(u => [u.id, u.username]));

    const ranking = merged.map((e, i) => ({
      position: i + 1,
      userId: e.userId,
      username: nameById.get(e.userId) ?? `user#${e.userId}`,
      commentsCount: e.commentsCount,
      booksAddedCount: e.booksAddedCount,
    }));

    return res.json({ ranking });
  } catch (err) {
    console.error('getGlobalRankingSameLogic error:', err);
    return res.status(500).json({ error: 'Error calculando el ranking global' });
  }
};
