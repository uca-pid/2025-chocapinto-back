// utils/scheduledTasks.js
const { notificarVotacionesPorVencer } = require('../controllers/periodo.controller');
const { notificarSesionesCercanas } = require('../controllers/sesion.controller');

/**
 * Ejecutar todas las verificaciones periódicas
 * Esta función debería ser llamada por un cron job o endpoint periódico
 */
async function ejecutarVerificacionesPeriodicas() {
  console.log('🕐 Ejecutando verificaciones periódicas...');
  
  try {
    // Verificar votaciones que vencen pronto
    const resultadoVotaciones = await notificarVotacionesPorVencer();
    console.log(`✅ Votaciones verificadas: ${resultadoVotaciones.count} notificaciones enviadas`);
    
    // Verificar sesiones cercanas
    const resultadoSesiones = await notificarSesionesCercanas();
    console.log(`✅ Sesiones verificadas: ${resultadoSesiones.count} notificaciones enviadas`);
    
    return {
      success: true,
      votaciones: resultadoVotaciones.count,
      sesiones: resultadoSesiones.count
    };
  } catch (error) {
    console.error('❌ Error en verificaciones periódicas:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Iniciar verificaciones periódicas cada hora
 */
function iniciarVerificacionesAutomaticas() {
  console.log('🚀 Iniciando verificaciones automáticas (cada 1 hora)...');
  
  // Ejecutar inmediatamente al iniciar
  ejecutarVerificacionesPeriodicas();
  
  // Luego ejecutar cada hora (3600000 ms = 1 hora)
  setInterval(ejecutarVerificacionesPeriodicas, 3600000);
}

module.exports = {
  ejecutarVerificacionesPeriodicas,
  iniciarVerificacionesAutomaticas
};
