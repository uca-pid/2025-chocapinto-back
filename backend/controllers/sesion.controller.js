const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

/**
 * Crear una nueva sesión de lectura (solo moderadores/owner)
 */
async function crearSesion(req, res) {
  try {
    const { clubId, clubBookId, titulo, descripcion, fechaHora, lugar } = req.body;
    const username = req.body.username; // Del middleware de autenticación

    // Validar campos requeridos
    if (!clubId || !titulo || !fechaHora || !lugar) {
      return res.status(400).json({
        success: false,
        message: "Faltan campos requeridos: clubId, titulo, fechaHora, lugar"
      });
    }

    // Verificar que el usuario sea moderador u owner del club
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

    // Verificar que el libro pertenece al club (si se especifica)
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

    // Crear la sesión
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

    return res.json({
      success: true,
      message: "Sesión creada exitosamente",
      sesion
    });

  } catch (error) {
    console.error("Error al crear sesión:", error);
    return res.status(500).json({
      success: false,
      message: "Error al crear la sesión",
      error: error.message
    });
  }
}

/**
 * Obtener todas las sesiones de un club
 */
async function obtenerSesionesClub(req, res) {
  try {
    const { clubId } = req.params;
    const { tipo } = req.query; // "proximas" o "pasadas"

    const now = new Date();
    let whereCondition = {
      clubId: parseInt(clubId)
    };

    // Filtrar por tipo
    if (tipo === "proximas") {
      whereCondition.fechaHora = { gte: now };
      whereCondition.estado = { not: "CANCELADA" };
    } else if (tipo === "pasadas") {
      whereCondition.OR = [
        { fechaHora: { lt: now } },
        { estado: "COMPLETADA" }
      ];
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

    // Calcular contadores para cada sesión
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
    console.error("Error al obtener sesiones:", error);
    return res.status(500).json({
      success: false,
      message: "Error al obtener las sesiones",
      error: error.message
    });
  }
}

/**
 * Obtener una sesión específica
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

    // Calcular contadores
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
    console.error("Error al obtener sesión:", error);
    return res.status(500).json({
      success: false,
      message: "Error al obtener la sesión",
      error: error.message
    });
  }
}

/**
 * Confirmar asistencia a una sesión
 */
async function confirmarAsistencia(req, res) {
  try {
    const { sesionId } = req.params;
    const { estado } = req.body; // "ASISTIRE", "NO_VOY", "TAL_VEZ"
    const username = req.body.username;

    // Validaciones
    if (!["ASISTIRE", "NO_VOY", "TAL_VEZ"].includes(estado)) {
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

    // Verificar que la sesión existe
    const sesion = await prisma.sesionLectura.findUnique({
      where: { id: parseInt(sesionId) }
    });

    if (!sesion) {
      return res.status(404).json({
        success: false,
        message: "Sesión no encontrada"
      });
    }

    // Verificar que el usuario es miembro del club
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

    // Crear o actualizar confirmación
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

    return res.json({
      success: true,
      message: "Confirmación registrada exitosamente",
      confirmacion
    });

  } catch (error) {
    console.error("Error al confirmar asistencia:", error);
    return res.status(500).json({
      success: false,
      message: "Error al confirmar asistencia",
      error: error.message
    });
  }
}

/**
 * Registrar asistencia real (después de la sesión - solo moderadores)
 */
async function registrarAsistenciaReal(req, res) {
  try {
    const { sesionId } = req.params;
    const { usuariosPresentes } = req.body; // Array de userIds
    const username = req.body.username;

    // Verificar que el usuario sea moderador u owner
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

    // Limpiar asistencias previas
    await prisma.asistenciaReal.deleteMany({
      where: { sesionId: parseInt(sesionId) }
    });

    // Registrar nuevas asistencias
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

    // Actualizar estado de la sesión a COMPLETADA
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
    console.error("Error al registrar asistencia real:", error);
    return res.status(500).json({
      success: false,
      message: "Error al registrar la asistencia",
      error: error.message
    });
  }
}

/**
 * Obtener próximas sesiones de todos los clubes del usuario (para notificaciones)
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
    console.error("Error al obtener próximas sesiones:", error);
    return res.status(500).json({
      success: false,
      message: "Error al obtener próximas sesiones",
      error: error.message
    });
  }
}

/**
 * Actualizar sesión (solo moderadores/owner)
 */
async function actualizarSesion(req, res) {
  try {
    const { sesionId } = req.params;
    const { titulo, descripcion, fechaHora, lugar, estado } = req.body;
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
    console.error("Error al actualizar sesión:", error);
    return res.status(500).json({
      success: false,
      message: "Error al actualizar la sesión",
      error: error.message
    });
  }
}

/**
 * Eliminar sesión (solo moderadores/owner)
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
    console.error("Error al eliminar sesión:", error);
    return res.status(500).json({
      success: false,
      message: "Error al eliminar la sesión",
      error: error.message
    });
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
  eliminarSesion
};
