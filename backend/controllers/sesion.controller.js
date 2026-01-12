const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const { notificarMiembrosClub } = require('./notificaciones.controller');
const { otorgarXP } = require('../utils/XPRewards');

/**
 * Crear una nueva sesión de lectura (solo moderadores/owner)
 * Ruta: POST /api/sesiones
 */
async function crearSesion(req, res) {
  try {
    const { clubId, clubBookId, titulo, descripcion, fechaHora, lugar } = req.body;
    const username = req.body.username;

    if (!clubId || !titulo || !fechaHora || !lugar) {
      return res.status(400).json({
        success: false,
        message: "Faltan campos requeridos: clubId, titulo, fechaHora, lugar"
      });
    }

    const user = await prisma.user.findUnique({
      where: { username }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Usuario no encontrado"
      });
    }

    const membership = await prisma.clubMember.findUnique({
      where: {
        userId_clubId: {
          userId: user.id,
          clubId: parseInt(clubId)
        }
      }
    });

    if (!membership || (membership.role !== "OWNER" && membership.role !== "MODERADOR")) {
      return res.status(403).json({
        success: false,
        message: "Solo moderadores y propietarios pueden crear sesiones"
      });
    }

    if (clubBookId) {
      const clubBook = await prisma.clubBook.findFirst({
        where: {
          id: parseInt(clubBookId),
          clubId: parseInt(clubId)
        }
      });

      if (!clubBook) {
        return res.status(404).json({
          success: false,
          message: "El libro no pertenece a este club"
        });
      }
    }

    const sesion = await prisma.sesionLectura.create({
      data: {
        clubId: parseInt(clubId),
        clubBookId: clubBookId ? parseInt(clubBookId) : null,
        titulo,
        descripcion: descripcion || null,
        fechaHora: new Date(fechaHora),
        lugar,
        estado: "PROGRAMADA"
      },
      include: {
        clubBook: {
          include: {
            book: true
          }
        },
        confirmaciones: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                avatar: true
              }
            }
          }
        }
      }
    });

    const club = await prisma.club.findUnique({
      where: { id: parseInt(clubId) },
      select: { name: true }
    });

    try {
      const fechaFormateada = new Date(fechaHora).toLocaleDateString('es-ES', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });

      await notificarMiembrosClub(
        parseInt(clubId),
        'SESION_CREADA',
        '📅 Nueva sesión de lectura',
        `Se ha programado una nueva sesión: "${titulo}" para el ${fechaFormateada}`,
        {
          sesionId: sesion.id,
          titulo: sesion.titulo,
          fechaHora: sesion.fechaHora,
          lugar: sesion.lugar,
          clubName: club.name
        },
        user.id
      );
    } catch (notifError) {
      console.error("[ERROR] Error al crear notificaciones:", notifError);
    }

    return res.json({
      success: true,
      message: "Sesión creada exitosamente",
      sesion
    });

  } catch (error) {
    console.error("[ERROR] Error al crear sesión:", error);
    return res.status(500).json({
      success: false,
      message: "Error al crear la sesión",
      error: error.message
    });
  }
}

/**
 * Obtener todas las sesiones de un club
 * Ruta: GET /api/club/:clubId/sesiones?tipo=proximas|pasadas
 */
async function obtenerSesionesClub(req, res) {
  try {
    const { clubId } = req.params;
    const { tipo } = req.query;

    const now = new Date();
    const nowArgentina = new Date(now.getTime() - (3 * 60 * 60 * 1000));
    
    await prisma.sesionLectura.updateMany({
      where: {
        clubId: parseInt(clubId),
        estado: "PROGRAMADA",
        fechaHora: { lt: nowArgentina }
      },
      data: {
        estado: "COMPLETADA"
      }
    });
    
    let whereCondition = {
      clubId: parseInt(clubId)
    };

    if (tipo === "proximas") {
      whereCondition.estado = "PROGRAMADA";
    } else if (tipo === "pasadas") {
      whereCondition.estado = "COMPLETADA";
    }

    const sesiones = await prisma.sesionLectura.findMany({
      where: whereCondition,
      include: {
        clubBook: {
          include: {
            book: true
          }
        },
        confirmaciones: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                avatar: true
              }
            }
          }
        },
        asistencias: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                avatar: true
              }
            }
          }
        }
      },
      orderBy: {
        fechaHora: tipo === "proximas" ? "asc" : "desc"
      }
    });

    const sesionesConContadores = sesiones.map(sesion => {
      const confirmaciones = sesion.confirmaciones;
      const asistire = confirmaciones.filter(c => c.estado === "ASISTIRE").length;
      const noVoy = confirmaciones.filter(c => c.estado === "NO_VOY").length;
      const talVez = confirmaciones.filter(c => c.estado === "TAL_VEZ").length;

      return {
        ...sesion,
        contadores: {
          asistire,
          noVoy,
          talVez,
          asistenciaReal: sesion.asistencias.length
        }
      };
    });

    return res.json({
      success: true,
      sesiones: sesionesConContadores
    });

  } catch (error) {
    console.error("[ERROR] Error al obtener sesiones:", error);
    return res.status(500).json({
      success: false,
      message: "Error al obtener las sesiones",
      error: error.message
    });
  }
}

/**
 * Obtener una sesión específica
 * Ruta: GET /api/sesiones/:sesionId
 */
async function obtenerSesion(req, res) {
  try {
    const { sesionId } = req.params;

    const sesion = await prisma.sesionLectura.findUnique({
      where: { id: parseInt(sesionId) },
      include: {
        club: {
          select: {
            id: true,
            name: true
          }
        },
        clubBook: {
          include: {
            book: true
          }
        },
        confirmaciones: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                avatar: true
              }
            }
          }
        },
        asistencias: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                avatar: true
              }
            }
          }
        }
      }
    });

    if (!sesion) {
      return res.status(404).json({
        success: false,
        message: "Sesión no encontrada"
      });
    }

    const confirmaciones = sesion.confirmaciones;
    const contadores = {
      asistire: confirmaciones.filter(c => c.estado === "ASISTIRE").length,
      noVoy: confirmaciones.filter(c => c.estado === "NO_VOY").length,
      talVez: confirmaciones.filter(c => c.estado === "TAL_VEZ").length,
      asistenciaReal: sesion.asistencias.length
    };

    return res.json({
      success: true,
      sesion: {
        ...sesion,
        contadores
      }
    });

  } catch (error) {
    console.error("[ERROR] Error al obtener sesión:", error);
    return res.status(500).json({
      success: false,
      message: "Error al obtener la sesión",
      error: error.message
    });
  }
}

/**
 * Confirmar asistencia a una sesión
 * Ruta: POST /api/sesiones/:sesionId/confirmar
 */
async function confirmarAsistencia(req, res) {
  try {
    const { sesionId } = req.params;
    const { estado } = req.body;
    const username = req.body.username;

    if (!['ASISTIRE', 'NO_VOY', 'TAL_VEZ'].includes(estado)) {
      return res.status(400).json({
        success: false,
        message: "Estado inválido. Debe ser: ASISTIRE, NO_VOY o TAL_VEZ"
      });
    }

    const user = await prisma.user.findUnique({
      where: { username }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Usuario no encontrado"
      });
    }

    const sesion = await prisma.sesionLectura.findUnique({
      where: { id: parseInt(sesionId) }
    });

    if (!sesion) {
      return res.status(404).json({
        success: false,
        message: "Sesión no encontrada"
      });
    }

    const membership = await prisma.clubMember.findUnique({
      where: {
        userId_clubId: {
          userId: user.id,
          clubId: sesion.clubId
        }
      }
    });

    if (!membership) {
      return res.status(403).json({
        success: false,
        message: "Debes ser miembro del club para confirmar asistencia"
      });
    }

    const confirmacionPrevia = await prisma.confirmacionAsistencia.findUnique({
      where: {
        sesionId_userId: {
          sesionId: parseInt(sesionId),
          userId: user.id
        }
      }
    });

    const confirmacion = await prisma.confirmacionAsistencia.upsert({
      where: {
        sesionId_userId: {
          sesionId: parseInt(sesionId),
          userId: user.id
        }
      },
      update: {
        estado
      },
      create: {
        sesionId: parseInt(sesionId),
        userId: user.id,
        estado
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            avatar: true
          }
        }
      }
    });

    if (estado === 'ASISTIRE' && (!confirmacionPrevia || confirmacionPrevia.estado !== 'ASISTIRE')) {
      await otorgarXP(user.id, 'CONFIRMAR_ASISTENCIA');
    }

    return res.json({
      success: true,
      message: "Confirmación registrada exitosamente",
      confirmacion
    });

  } catch (error) {
    console.error("[ERROR] Error al confirmar asistencia:", error);
    return res.status(500).json({
      success: false,
      message: "Error al confirmar asistencia",
      error: error.message
    });
  }
}

/**
 * Registrar asistencia real (después de la sesión - solo moderadores)
 * Ruta: POST /api/sesiones/:sesionId/asistencia
 */
async function registrarAsistenciaReal(req, res) {
  try {
    const { sesionId } = req.params;
    const { usuariosPresentes } = req.body;
    const username = req.body.username;

    const user = await prisma.user.findUnique({
      where: { username }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Usuario no encontrado"
      });
    }

    const sesion = await prisma.sesionLectura.findUnique({
      where: { id: parseInt(sesionId) }
    });

    if (!sesion) {
      return res.status(404).json({
        success: false,
        message: "Sesión no encontrada"
      });
    }

    const membership = await prisma.clubMember.findUnique({
      where: {
        userId_clubId: {
          userId: user.id,
          clubId: sesion.clubId
        }
      }
    });

    if (!membership || (membership.role !== "OWNER" && membership.role !== "MODERADOR")) {
      return res.status(403).json({
        success: false,
        message: "Solo moderadores y propietarios pueden registrar asistencia"
      });
    }

    const asistenciasPrevias = await prisma.asistenciaReal.findMany({
      where: { sesionId: parseInt(sesionId) },
      select: { userId: true }
    });
    
    const usuariosPrevios = new Set(asistenciasPrevias.map(a => a.userId));

    await prisma.asistenciaReal.deleteMany({
      where: { sesionId: parseInt(sesionId) }
    });

    const asistencias = await Promise.all(
      usuariosPresentes.map(userId =>
        prisma.asistenciaReal.create({
          data: {
            sesionId: parseInt(sesionId),
            userId: parseInt(userId)
          },
          include: {
            user: {
              select: {
                id: true,
                username: true,
                avatar: true
              }
            }
          }
        })
      )
    );

    for (const asistencia of asistencias) {
      if (!usuariosPrevios.has(asistencia.userId)) {
        await otorgarXP(asistencia.userId, 'ASISTIR_SESION');
      }
    }

    await prisma.sesionLectura.update({
      where: { id: parseInt(sesionId) },
      data: { estado: "COMPLETADA" }
    });

    return res.json({
      success: true,
      message: "Asistencia registrada exitosamente",
      asistencias
    });

  } catch (error) {
    console.error("[ERROR] Error al registrar asistencia real:", error);
    return res.status(500).json({
      success: false,
      message: "Error al registrar la asistencia",
      error: error.message
    });
  }
}

/**
 * Obtener próximas sesiones de todos los clubes del usuario
 * Ruta: GET /api/sesiones/proximas
 */
async function obtenerProximasSesionesUsuario(req, res) {
  try {
    const username = req.body.username || req.query.username;

    const user = await prisma.user.findUnique({
      where: { username },
      include: {
        memberships: {
          select: {
            clubId: true
          }
        }
      }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Usuario no encontrado"
      });
    }

    const clubIds = user.memberships.map(m => m.clubId);
    const now = new Date();
    const unaSemanaAdelante = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const proximasSesiones = await prisma.sesionLectura.findMany({
      where: {
        clubId: { in: clubIds },
        fechaHora: {
          gte: now,
          lte: unaSemanaAdelante
        },
        estado: "PROGRAMADA"
      },
      include: {
        club: {
          select: {
            id: true,
            name: true
          }
        },
        clubBook: {
          include: {
            book: true
          }
        },
        confirmaciones: {
          where: {
            userId: user.id
          }
        }
      },
      orderBy: {
        fechaHora: "asc"
      }
    });

    return res.json({
      success: true,
      sesiones: proximasSesiones
    });

  } catch (error) {
    console.error("[ERROR] Error al obtener próximas sesiones:", error);
    return res.status(500).json({
      success: false,
      message: "Error al obtener próximas sesiones",
      error: error.message
    });
  }
}

/**
 * Actualizar sesión (solo moderadores/owner)
 * Ruta: PUT /api/sesiones/:sesionId
 */
async function actualizarSesion(req, res) {
  try {
    const { sesionId } = req.params;
    const { titulo, descripcion, fechaHora, lugar, estado, clubBookId } = req.body;
    const username = req.body.username;

    const user = await prisma.user.findUnique({
      where: { username }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Usuario no encontrado"
      });
    }

    const sesion = await prisma.sesionLectura.findUnique({
      where: { id: parseInt(sesionId) }
    });

    if (!sesion) {
      return res.status(404).json({
        success: false,
        message: "Sesión no encontrada"
      });
    }

    const membership = await prisma.clubMember.findUnique({
      where: {
        userId_clubId: {
          userId: user.id,
          clubId: sesion.clubId
        }
      }
    });

    if (!membership || (membership.role !== "OWNER" && membership.role !== "MODERADOR")) {
      return res.status(403).json({
        success: false,
        message: "Solo moderadores y propietarios pueden actualizar sesiones"
      });
    }

    const datosActualizacion = {};
    if (titulo) datosActualizacion.titulo = titulo;
    if (descripcion !== undefined) datosActualizacion.descripcion = descripcion;
    if (fechaHora) datosActualizacion.fechaHora = new Date(fechaHora);
    if (lugar) datosActualizacion.lugar = lugar;
    if (estado) datosActualizacion.estado = estado;
    if (clubBookId !== undefined) datosActualizacion.clubBookId = clubBookId ? parseInt(clubBookId) : null;

    const sesionActualizada = await prisma.sesionLectura.update({
      where: { id: parseInt(sesionId) },
      data: datosActualizacion,
      include: {
        clubBook: {
          include: {
            book: true
          }
        }
      }
    });

    return res.json({
      success: true,
      message: "Sesión actualizada exitosamente",
      sesion: sesionActualizada
    });

  } catch (error) {
    console.error("[ERROR] Error al actualizar sesión:", error);
    return res.status(500).json({
      success: false,
      message: "Error al actualizar la sesión",
      error: error.message
    });
  }
}

/**
 * Eliminar sesión (solo moderadores/owner)
 * Ruta: DELETE /api/sesiones/:sesionId
 */
async function eliminarSesion(req, res) {
  try {
    const { sesionId } = req.params;
    const username = req.body.username;

    const user = await prisma.user.findUnique({
      where: { username }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Usuario no encontrado"
      });
    }

    const sesion = await prisma.sesionLectura.findUnique({
      where: { id: parseInt(sesionId) }
    });

    if (!sesion) {
      return res.status(404).json({
        success: false,
        message: "Sesión no encontrada"
      });
    }

    const membership = await prisma.clubMember.findUnique({
      where: {
        userId_clubId: {
          userId: user.id,
          clubId: sesion.clubId
        }
      }
    });

    if (!membership || (membership.role !== "OWNER" && membership.role !== "MODERADOR")) {
      return res.status(403).json({
        success: false,
        message: "Solo moderadores y propietarios pueden eliminar sesiones"
      });
    }

    await prisma.sesionLectura.delete({
      where: { id: parseInt(sesionId) }
    });

    return res.json({
      success: true,
      message: "Sesión eliminada exitosamente"
    });

  } catch (error) {
    console.error("[ERROR] Error al eliminar sesión:", error);
    return res.status(500).json({
      success: false,
      message: "Error al eliminar la sesión",
      error: error.message
    });
  }
}

/**
 * Verificar y notificar sesiones que ocurren en menos de 24 horas
 */
async function notificarSesionesCercanas() {
  try {
    const ahora = new Date();
    const en24Horas = new Date(ahora.getTime() + 24 * 60 * 60 * 1000);

    const sesionesCercanas = await prisma.sesionLectura.findMany({
      where: {
        estado: 'PROGRAMADA',
        fechaHora: {
          gte: ahora,
          lte: en24Horas
        }
      },
      include: {
        club: true,
        clubBook: {
          include: {
            book: true
          }
        }
      }
    });

    for (const sesion of sesionesCercanas) {
      const horasRestantes = Math.round((new Date(sesion.fechaHora) - ahora) / (1000 * 60 * 60));
      const fechaFormateada = new Date(sesion.fechaHora).toLocaleDateString('es-ES', {
        day: 'numeric',
        month: 'long',
        hour: '2-digit',
        minute: '2-digit'
      });

      try {
        await notificarMiembrosClub(
          sesion.clubId,
          'SESION_PROXIMA',
          '📅 Sesión próxima',
          `Recordatorio: La sesión "${sesion.titulo}" en ${sesion.club.name} es el ${fechaFormateada}${sesion.lugar ? ` en ${sesion.lugar}` : ''}. ¡No olvides asistir!`,
          {
            sesionId: sesion.id,
            titulo: sesion.titulo,
            clubName: sesion.club.name,
            fechaHora: sesion.fechaHora,
            lugar: sesion.lugar,
            horasRestantes,
            libro: sesion.clubBook?.book?.title
          },
          null
        );
      } catch (notifError) {
        console.error(`[ERROR] Error al notificar sesión cercana (${sesion.id}):`, notifError.message);
      }
    }

    return { count: sesionesCercanas.length };
  } catch (error) {
    console.error('[ERROR] Error al verificar sesiones cercanas:', error);
    return { count: 0, error: error.message };
  }
}

module.exports = {
  crearSesion,
  obtenerSesionesClub,
  obtenerSesion,
  confirmarAsistencia,
  registrarAsistenciaReal,
  obtenerProximasSesionesUsuario,
  actualizarSesion,
  eliminarSesion,
  notificarSesionesCercanas
};
