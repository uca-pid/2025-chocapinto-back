const XP_PER_BOOK_FINISHED = 100;

const XP_PER_LEVEL = 500;

/**
 * Recibe un usuario y cuánta XP gana,
 * devuelve los nuevos valores de xp y level.
 */
function computeNewXpAndLevel(user, xpGained = XP_PER_BOOK_FINISHED) {
  const currentXp = user.xp || 0;
  const currentLevel = user.level || 1;

  const newXp = currentXp + xpGained;
  let newLevel = currentLevel;

  // Regla simple: cada nivel requiere XP_PER_LEVEL * nivel actual
  // Puedes cambiarla cuando quieras.
  while (newXp >= newLevel * XP_PER_LEVEL) {
    newLevel++;
  }

  return { xp: newXp, level: newLevel };
}

module.exports = {
  XP_PER_BOOK_FINISHED,
  XP_PER_LEVEL,
  computeNewXpAndLevel,
};
