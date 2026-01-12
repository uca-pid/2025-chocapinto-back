// src/controllers/history.controller.js
const prisma = require('../db');
const { validateRequiredFields } = require('../utils/validateFields');

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
    
    console.log('Buscando historial del club:', clubId);
    console.log('Filtros aplicados:', whereClause);
    
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
    
    console.log('Historial encontrado:', historial.length, 'entradas');
    
    res.json({ success: true, historial });
  } catch (error) {
    console.error('Error al obtener historial del club:', error);
    res.status(500).json({ success: false, message: "Error al obtener historial del club" });
  }
};

const getClubStats = async (req, res) => {
  try {
    const clubId = Number(req.params.clubId);
    const { año, mes } = req.query;
    
    if (!clubId) {
      return res.status(400).json({ success: false, message: "ID de club inválido" });
    }

    const whereClause = { clubId };
    
    // Filtro por fecha si se especifica
    if (año) {
      const startDate = new Date(año, mes ? mes - 1 : 0, 1);
      const endDate = mes 
        ? new Date(año, mes, 0) 
        : new Date(año + 1, 0, 0);
      whereClause.fechaCambio = { gte: startDate, lte: endDate };
    }
    
    // Obtener todo el historial del club
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
    
    // Obtener solo libros leídos
    const librosLeidos = todosLosCambios.filter(entry => entry.estado === 'leido');
    
    // Estadísticas por género
    const estadisticasPorGenero = {};
    const estadisticasPorMes = {};
    const estadisticasPorUsuario = {};
    
    librosLeidos.forEach(entry => {
      // Por género
      if (entry.book.categorias) {
        entry.book.categorias.forEach(cat => {
          estadisticasPorGenero[cat.nombre] = (estadisticasPorGenero[cat.nombre] || 0) + 1;
        });
      }
      
      // Por mes
      const mes = entry.fechaCambio.toISOString().substring(0, 7); // YYYY-MM
      estadisticasPorMes[mes] = (estadisticasPorMes[mes] || 0) + 1;
      
      // Por usuario
      const username = entry.user.username;
      estadisticasPorUsuario[username] = (estadisticasPorUsuario[username] || 0) + 1;
    });
    
    // Calcular usuario más activo
    const usuarioMasActivo = Object.keys(estadisticasPorUsuario).length > 0 
      ? Object.keys(estadisticasPorUsuario).reduce((a, b) => 
          estadisticasPorUsuario[a] > estadisticasPorUsuario[b] ? a : b
        )
      : null;
    
    // Calcular promedio de tiempo de lectura
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
    console.error('Error al obtener estadísticas del club:', error);
    res.status(500).json({ success: false, message: "Error al obtener estadísticas del club" });
  }
};

module.exports = {
  getClubHistory,
  getClubStats
};