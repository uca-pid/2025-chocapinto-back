// routes/scheduled.routes.js
const express = require('express');
const router = express.Router();
const { ejecutarVerificacionesPeriodicas } = require('../utils/scheduledTasks');

/**
 * POST /api/scheduled/verificar
 * Ejecutar verificaciones periódicas manualmente (útil para testing)
 */
router.post('/verificar', async (req, res) => {
  try {
    const resultado = await ejecutarVerificacionesPeriodicas();
    
    res.json({
      success: true,
      message: 'Verificaciones ejecutadas correctamente',
      resultado
    });
  } catch (error) {
    console.error('Error al ejecutar verificaciones:', error);
    res.status(500).json({
      success: false,
      message: 'Error al ejecutar verificaciones',
      error: error.message
    });
  }
});

module.exports = router;
