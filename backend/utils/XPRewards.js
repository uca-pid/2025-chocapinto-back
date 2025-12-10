/**
 * Sistema de Experiencia (XP) y Recompensas
 * Maneja el cálculo de niveles y otorgamiento de XP por acciones del usuario.
 */

const prisma = require('../db');
const { crearNotificacion } = require('../controllers/notificaciones.controller');

const XP_PER_LEVEL = 500;

const XP_REWARDS = {
  COMPLETAR_LIBRO: 100,
  VOTAR: 10,
  PRIMER_COMENTARIO_LIBRO: 20,
  COMENTARIO_ADICIONAL: 5,
  CREAR_CLUB: 50,
  UNIRSE_CLUB: 15,
  AGREGAR_LIBRO: 10,
  CREAR_VOTACION: 20,
  CONFIRMAR_ASISTENCIA: 5,
  ASISTIR_SESION: 25,
  ORGANIZAR_SESION: 30
};

/**
 * Calcula el nuevo XP y nivel después de ganar experiencia.
 * @param {Object} user - Objeto usuario con xp y level actuales
 * @param {number} xpGained - Cantidad de XP ganada
 * @returns {Object} Objeto con xp y level actualizados
 */
function computeNewXpAndLevel(user, xpGained) {
  const currentXp = user.xp || 0;
  const currentLevel = user.level || 1;

  const newXp = currentXp + xpGained;
  let newLevel = currentLevel;

  while (newXp >= newLevel * XP_PER_LEVEL) {
    newLevel++;
  }

  return { xp: newXp, level: newLevel };
}

/**
 * Otorga XP a un usuario y notifica si sube de nivel
 * @param {number} userId - ID del usuario
 * @param {string} tipoAccion - Tipo de acción (debe estar en XP_REWARDS)
 * @param {number|null} cantidad - Cantidad personalizada de XP (opcional)
 * @returns {Promise<Object>} Resultado con info de nivel
 */
async function otorgarXP(userId, tipoAccion, cantidad = null) {
  try {
    const xpGanado = cantidad || XP_REWARDS[tipoAccion] || 0;
    
    if (xpGanado === 0) {
      return { levelUp: false, xpGanado: 0 };
    }

    const usuario = await prisma.user.findUnique({
      where: { id: userId },
      select: { xp: true, level: true, username: true }
    });

    if (!usuario) {
      console.error(`[ERROR] Usuario ${userId} no encontrado`);
      return { levelUp: false, xpGanado: 0 };
    }

    const oldLevel = usuario.level || 1;
    const oldXp = usuario.xp || 0;
    
    const { xp: newXp, level: newLevel } = computeNewXpAndLevel(usuario, xpGanado);

    await prisma.user.update({
      where: { id: userId },
      data: {
        xp: newXp,
        level: newLevel
      }
    });

    if (newLevel > oldLevel) {
      const accionLegible = tipoAccion.toLowerCase().replace(/_/g, ' ');
      
      await crearNotificacion(
        userId,
        'NIVEL_SUBIDO',
        '🎉 ¡Subiste de nivel!',
        `¡Felicidades! Ahora eres nivel ${newLevel}. Ganaste ${xpGanado} XP por ${accionLegible}.`,
        { 
          oldLevel, 
          newLevel, 
          xpGanado, 
          xpTotal: newXp,
          accion: tipoAccion 
        }
      ).catch(err => console.error('[ERROR] Error al notificar nivel subido:', err));
    }

    return {
      levelUp: newLevel > oldLevel,
      oldLevel,
      newLevel,
      xpGanado,
      xpTotal: newXp
    };

  } catch (error) {
    console.error(`[ERROR] Error al otorgar XP (${tipoAccion}):`, error);
    return { levelUp: false, xpGanado: 0, error: error.message };
  }
}

/**
 * Obtiene un mensaje descriptivo según el tipo de acción.
 * @param {string} tipoAccion - Tipo de acción del sistema de XP
 * @returns {string} Descripción legible de la acción
 */
function getAccionDescripcion(tipoAccion) {
  const descripciones = {
    VOTAR: 'votar en una votación',
    UNIRSE_CLUB: 'unirte a un club',
    PRIMER_COMENTARIO_LIBRO: 'tu primer comentario en este libro',
    COMENTARIO_ADICIONAL: 'comentar',
    CONFIRMAR_ASISTENCIA: 'confirmar asistencia a una sesión',
    ASISTIR_SESION: 'asistir a una sesión',
    COMPLETAR_LIBRO: 'completar un libro',
    CREAR_CLUB: 'crear un club',
    AGREGAR_LIBRO: 'agregar un libro al club',
    CREAR_VOTACION: 'crear una votación',
    ORGANIZAR_SESION: 'organizar una sesión'
  };
  
  return descripciones[tipoAccion] || tipoAccion.toLowerCase().replace(/_/g, ' ');
}

module.exports = {
  XP_PER_LEVEL,
  XP_REWARDS,
  computeNewXpAndLevel,
  otorgarXP,
  getAccionDescripcion
};
