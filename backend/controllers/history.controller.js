// src/controllers/history.controller.js
const prisma = require('../db');

/**
 * Obtiene el historial de lectura de un club con filtros opcionales
 * Ruta: GET /api/club/:clubId/history
 */
const getClubHistory = async (req, res) => {
  try {
    const clubId = Number(req.params.clubId);
    const { estado, desde, hasta, userId } = req.query;
    
    if (!clubId) {
      return res.status(400).json({ success: false, message: "ID de club inválido" });
    }

    const whereClause = { clubId };
    if (estado) whereClause.estado = estado;
    if (userId) whereClause.userId = Number(userId);
    if (desde) whereClause.fechaCambio = { gte: new Date(desde) };
    if (hasta) whereClause.fechaCambio = { ...whereClause.fechaCambio, lte: new Date(hasta) };
    
    const historial = await prisma.readingHistory.findMany({
      where: whereClause,
      include: {
        book: {
          include: {
            categorias: true
          }
        },
        user: { select: { id: true, username: true } }
      },
      orderBy: { fechaCambio: 'desc' }
    });
    
    res.json({ success: true, historial });
  } catch (error) {
    console.error('[ERROR] Error al obtener historial del club:', error);
    res.status(500).json({ success: false, message: "Error al obtener historial del club" });
  }
};

/**
 * Obtiene estadísticas de lectura del club
 * Ruta: GET /api/club/:clubId/stats
 */
const getClubStats = async (req, res) => {
  try {
    const clubId = Number(req.params.clubId);
    const { año, mes } = req.query;
    
    if (!clubId) {
      return res.status(400).json({ success: false, message: "ID de club inválido" });
    }

    const whereClause = { clubId };
    
    if (año) {
      const startDate = new Date(año, mes ? mes - 1 : 0, 1);
      const endDate = mes 
        ? new Date(año, mes, 0) 
        : new Date(año + 1, 0, 0);
      whereClause.fechaCambio = { gte: startDate, lte: endDate };
    }
    
    const todosLosCambios = await prisma.readingHistory.findMany({
      where: whereClause,
      include: { 
        book: {
          include: {
            categorias: true
          }
        },
        user: { select: { id: true, username: true } }
      }
    });
    
    const librosLeidos = todosLosCambios.filter(entry => entry.estado === 'leido');
    
    const estadisticasPorGenero = {};
    const estadisticasPorMes = {};
    const estadisticasPorUsuario = {};
    
    librosLeidos.forEach(entry => {
      if (entry.book.categorias) {
        entry.book.categorias.forEach(cat => {
          estadisticasPorGenero[cat.nombre] = (estadisticasPorGenero[cat.nombre] || 0) + 1;
        });
      }
      
      const mes = entry.fechaCambio.toISOString().substring(0, 7);
      estadisticasPorMes[mes] = (estadisticasPorMes[mes] || 0) + 1;
      
      const username = entry.user.username;
      estadisticasPorUsuario[username] = (estadisticasPorUsuario[username] || 0) + 1;
    });
    
    const usuarioMasActivo = Object.keys(estadisticasPorUsuario).length > 0 
      ? Object.keys(estadisticasPorUsuario).reduce((a, b) => 
          estadisticasPorUsuario[a] > estadisticasPorUsuario[b] ? a : b
        )
      : null;
    
    const tiemposLectura = librosLeidos
      .filter(h => h.fechaInicio && h.fechaFin)
      .map(h => {
        const inicio = new Date(h.fechaInicio);
        const fin = new Date(h.fechaFin);
        return Math.ceil((fin - inicio) / (1000 * 60 * 60 * 24));
      });
    
    const promedioLectura = tiemposLectura.length > 0 
      ? Math.round(tiemposLectura.reduce((a, b) => a + b, 0) / tiemposLectura.length)
      : 0;
    
    res.json({
      success: true,
      stats: {
        totalCambios: todosLosCambios.length,
        totalLeidos: librosLeidos.length,
        porGenero: estadisticasPorGenero,
        porMes: estadisticasPorMes,
        porUsuario: estadisticasPorUsuario,
        usuarioMasActivo,
        promedioLectura,
        cambiosRecientes: todosLosCambios.slice(0, 20)
      }
    });
  } catch (error) {
    console.error('[ERROR] Error al obtener estadísticas del club:', error);
    res.status(500).json({ success: false, message: "Error al obtener estadísticas del club" });
  }
};

module.exports = {
  getClubHistory,
  getClubStats
};