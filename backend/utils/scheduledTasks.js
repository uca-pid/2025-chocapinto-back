/**
 * Utilidad: Scheduled Tasks
 * Sistema de tareas programadas para notificaciones periódicas.
 */

const { notificarVotacionesPorVencer } = require('../controllers/periodo.controller');
const { notificarSesionesCercanas } = require('../controllers/sesion.controller');

/**
 * Ejecuta todas las verificaciones periódicas.
 * Esta función debería ser llamada por un cron job o endpoint periódico.
 * @returns {Promise<Object>} Resultado de las verificaciones con contadores
 */
async function ejecutarVerificacionesPeriodicas() {
  try {
    const resultadoVotaciones = await notificarVotacionesPorVencer();
    const resultadoSesiones = await notificarSesionesCercanas();
    
    return {
      success: true,
      votaciones: resultadoVotaciones.count,
      sesiones: resultadoSesiones.count
    };
  } catch (error) {
    console.error('[ERROR] Error en verificaciones periódicas:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Inicia verificaciones periódicas cada hora.
 * Ejecuta inmediatamente al iniciar y luego cada 3600000 ms (1 hora).
 */
function iniciarVerificacionesAutomaticas() {
  ejecutarVerificacionesPeriodicas();
  
  setInterval(ejecutarVerificacionesPeriodicas, 3600000);
}

module.exports = {
  ejecutarVerificacionesPeriodicas,
  iniciarVerificacionesAutomaticas
};
