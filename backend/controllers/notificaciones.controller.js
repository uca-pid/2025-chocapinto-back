// src/controllers/notificaciones.controller.js
const prisma = require('../db');

/**
 * Crear una notificación para un usuario específico
 */
const crearNotificacion = async (userId, tipo, titulo, mensaje, datos = null) => {
  try {
    const notificacion = await prisma.notificacion.create({
      data: {
        userId,
        tipo,
        titulo,
        mensaje,
        datos: datos ? JSON.stringify(datos) : null,
        leida: false
      }
    });
    return notificacion;
  } catch (error) {
    console.error('[ERROR] Error al crear notificación:', error);
    throw error;
  }
};

/**
 * Crear notificaciones para múltiples usuarios (broadcast)
 */
const crearNotificacionesMasivas = async (userIds, tipo, titulo, mensaje, datos = null) => {
  try {
    if (!tipo || !titulo || !mensaje) {
      console.error('[ERROR] Parámetros faltantes en crearNotificacionesMasivas:', { tipo, titulo, mensaje });
      throw new Error('Los parámetros tipo, titulo y mensaje son requeridos');
    }

    const notificaciones = await prisma.notificacion.createMany({
      data: userIds.map(userId => ({
        userId,
        tipo,
        titulo,
        mensaje,
        datos: datos ? JSON.stringify(datos) : null,
        leida: false
      }))
    });
    return notificaciones;
  } catch (error) {
    console.error('[ERROR] Error al crear notificaciones masivas:', error);
    throw error;
  }
};

/**
 * Obtiene todas las notificaciones de un usuario
 * Ruta: GET /api/notificaciones/:userId
 */
const obtenerNotificacionesUsuario = async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    const { leidas } = req.query;

    const where = { userId };
    
    if (leidas !== undefined) {
      where.leida = leidas === 'true';
    }

    const notificaciones = await prisma.notificacion.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 50
    });

    const notificacionesFormateadas = notificaciones.map(notif => ({
      ...notif,
      datos: notif.datos ? JSON.parse(notif.datos) : null
    }));

    res.json({
      success: true,
      notificaciones: notificacionesFormateadas,
      total: notificaciones.length
    });
  } catch (error) {
    console.error('[ERROR] Error al obtener notificaciones:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener notificaciones'
    });
  }
};

/**
 * Cuenta notificaciones no leídas de un usuario
 * Ruta: GET /api/notificaciones/:userId/no-leidas/count
 */
const contarNotificacionesNoLeidas = async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);

    const count = await prisma.notificacion.count({
      where: {
        userId,
        leida: false
      }
    });

    res.json({
      success: true,
      count
    });
  } catch (error) {
    console.error('[ERROR] Error al contar notificaciones no leídas:', error);
    res.status(500).json({
      success: false,
      message: 'Error al contar notificaciones'
    });
  }
};

/**
 * Marca una notificación como leída
 * Ruta: PUT /api/notificaciones/:notificacionId/leer
 */
const marcarComoLeida = async (req, res) => {
  try {
    const notificacionId = parseInt(req.params.notificacionId);

    const notificacion = await prisma.notificacion.update({
      where: { id: notificacionId },
      data: { leida: true }
    });

    res.json({
      success: true,
      message: 'Notificación marcada como leída',
      notificacion
    });
  } catch (error) {
    console.error('[ERROR] Error al marcar notificación como leída:', error);
    res.status(500).json({
      success: false,
      message: 'Error al actualizar notificación'
    });
  }
};

/**
 * Marca todas las notificaciones de un usuario como leídas
 * Ruta: PUT /api/notificaciones/:userId/leer-todas
 */
const marcarTodasComoLeidas = async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);

    const resultado = await prisma.notificacion.updateMany({
      where: {
        userId,
        leida: false
      },
      data: { leida: true }
    });

    res.json({
      success: true,
      message: `${resultado.count} notificaciones marcadas como leídas`,
      count: resultado.count
    });
  } catch (error) {
    console.error('[ERROR] Error al marcar todas como leídas:', error);
    res.status(500).json({
      success: false,
      message: 'Error al actualizar notificaciones'
    });
  }
};

/**
 * Elimina una notificación
 * Ruta: DELETE /api/notificaciones/:notificacionId
 */
const eliminarNotificacion = async (req, res) => {
  try {
    const notificacionId = parseInt(req.params.notificacionId);

    await prisma.notificacion.delete({
      where: { id: notificacionId }
    });

    res.json({
      success: true,
      message: 'Notificación eliminada'
    });
  } catch (error) {
    console.error('[ERROR] Error al eliminar notificación:', error);
    res.status(500).json({
      success: false,
      message: 'Error al eliminar notificación'
    });
  }
};

/**
 * Elimina todas las notificaciones leídas de un usuario
 * Ruta: DELETE /api/notificaciones/:userId/limpiar
 */
const limpiarNotificacionesLeidas = async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);

    const resultado = await prisma.notificacion.deleteMany({
      where: {
        userId,
        leida: true
      }
    });

    res.json({
      success: true,
      message: `${resultado.count} notificaciones eliminadas`,
      count: resultado.count
    });
  } catch (error) {
    console.error('[ERROR] Error al limpiar notificaciones:', error);
    res.status(500).json({
      success: false,
      message: 'Error al limpiar notificaciones'
    });
  }
};

/**
 * Notifica a todos los miembros de un club
 */
const notificarMiembrosClub = async (clubId, tipo, titulo, mensaje, datos = null, excluirUsuarioId = null) => {
  try {
    const miembros = await prisma.clubMember.findMany({
      where: { clubId },
      select: { userId: true }
    });

    let userIds = miembros.map(m => m.userId);
    if (excluirUsuarioId) {
      userIds = userIds.filter(id => id !== excluirUsuarioId);
    }

    if (userIds.length === 0) {
      return { count: 0 };
    }

    const datosConClub = { ...datos, clubId };
    
    await crearNotificacionesMasivas(userIds, tipo, titulo, mensaje, datosConClub);

    return { count: userIds.length };
  } catch (error) {
    console.error('[ERROR] Error al notificar miembros del club:', error);
    throw error;
  }
};

module.exports = {
  crearNotificacion,
  crearNotificacionesMasivas,
  obtenerNotificacionesUsuario,
  contarNotificacionesNoLeidas,
  marcarComoLeida,
  marcarTodasComoLeidas,
  eliminarNotificacion,
  limpiarNotificacionesLeidas,
  notificarMiembrosClub
};
