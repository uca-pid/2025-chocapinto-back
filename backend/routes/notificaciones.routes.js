// src/routes/notificaciones.routes.js
const express = require('express');
const router = express.Router();
const {
  obtenerNotificacionesUsuario,
  contarNotificacionesNoLeidas,
  marcarComoLeida,
  marcarTodasComoLeidas,
  eliminarNotificacion,
  limpiarNotificacionesLeidas
} = require('../controllers/notificaciones.controller');



// Contar notificaciones no leídas
// GET /api/notificaciones/:userId/no-leidas/count
router.get('/:userId/no-leidas/count', contarNotificacionesNoLeidas);

// Marcar todas las notificaciones de un usuario como leídas
// PUT /api/notificaciones/:userId/leer-todas
router.put('/:userId/leer-todas', marcarTodasComoLeidas);

// Limpiar todas las notificaciones leídas de un usuario
// DELETE /api/notificaciones/:userId/limpiar
router.delete('/:userId/limpiar', limpiarNotificacionesLeidas);

// Obtener todas las notificaciones de un usuario
// GET /api/notificaciones/:userId?leidas=true/false
router.get('/:userId', obtenerNotificacionesUsuario);

// Marcar una notificación como leída
// PUT /api/notificaciones/:notificacionId/leer
router.put('/:notificacionId/leer', marcarComoLeida);

// Eliminar una notificación específica
// DELETE /api/notificaciones/:notificacionId
router.delete('/:notificacionId', eliminarNotificacion);

module.exports = router;
