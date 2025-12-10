// src/controllers/club.controller.js
const prisma = require('../db');
const { validateRequiredFields } = require('../utils/validateFields');
const { crearNotificacion } = require('./notificaciones.controller');
const { otorgarXP } = require('../utils/XPRewards');

const DEFAULT_CLUB_IMAGE = "https://img.lovepik.com/png/20231109/book-cartoon-illustration-school-start-reading-reading-book_539915_wh860.png";

/**
 * Crea un nuevo club de lectura
 * Ruta: POST /api/club
 */
const createClub = async (req, res) => {
  try {
    const { name, description, ownerUsername, imagen } = req.body;

    const missingFields = validateRequiredFields(['name', 'description', 'ownerUsername'], req.body);
    if (missingFields) {
      return res.status(400).json({ success: false, message: "Faltan datos requeridos" });
    }

    const owner = await prisma.user.findUnique({ where: { username: ownerUsername } });
    if (!owner) {
      return res.status(404).json({ success: false, message: "Usuario no encontrado" });
    }

    const club = await prisma.club.create({
      data: {
        name,
        description,
        id_owner: owner.id,
        imagen: imagen || DEFAULT_CLUB_IMAGE
      }
    });

    await prisma.clubMember.create({
      data: {
        userId: owner.id,
        clubId: club.id,
        role: 'OWNER'
      }
    });

    const clubWithMembers = await prisma.club.findUnique({
      where: { id: club.id },
      include: {
        memberships: {
          include: {
            user: true
          }
        }
      }
    });

    const clubFormatted = {
      ...clubWithMembers,
      members: clubWithMembers.memberships.map(membership => ({
        ...membership.user,
        role: membership.role,
        joinedAt: membership.joinedAt
      }))
    };

    res.json({ success: true, club: clubFormatted });
  } catch (error) {
    console.error("[ERROR] Error al crear club:", error);
    res.status(500).json({ success: false, message: "Error del servidor" });
  }
};

/**
 * Elimina un club y todas sus relaciones
 * Ruta: DELETE /api/club/:id
 */
const deleteClub = async (req, res) => {
  try {
    const clubId = Number(req.params.id);
    if (!clubId) {
      return res.status(400).json({ success: false, message: "ID inválido" });
    }

    await prisma.$transaction(async (tx) => {
      await tx.clubMember.deleteMany({
        where: { clubId: clubId }
      });
      
      await tx.clubSolicitud.deleteMany({
        where: { clubId: clubId }
      });
      
      await tx.readingHistory.deleteMany({
        where: { clubId: clubId }
      });
      
      const clubBooks = await tx.clubBook.findMany({
        where: { clubId: clubId }
      });
      
      for (const clubBook of clubBooks) {
        await tx.comment.deleteMany({
          where: { clubBookId: clubBook.id }
        });
      }
      
      await tx.clubBook.deleteMany({
        where: { clubId: clubId }
      });
      
      await tx.club.delete({ where: { id: clubId } });
    });

    res.json({ success: true, message: "Club eliminado correctamente" });
  } catch (error) {
    console.error("[ERROR] Error al eliminar club:", error);
    res.status(500).json({ success: false, message: "Error del servidor" });
  }
};

/**
 * Obtiene todos los clubes
 * Ruta: GET /api/club
 */
const getAllClubs = async (req, res) => {
  try {
    const clubs = await prisma.club.findMany({
      include: { 
        memberships: {
          include: {
            user: true
          }
        }
      }
    });
    
    const clubsFormatted = clubs.map(club => ({
      ...club,
      members: club.memberships.map(membership => ({
        ...membership.user,
        role: membership.role,
        joinedAt: membership.joinedAt
      }))
    }));
    
    res.json({ success: true, clubs: clubsFormatted });
  } catch (error) {
    console.error("[ERROR] Error al obtener clubes:", error);
    res.status(500).json({ success: false, message: "Error del servidor" });
  }
};

/**
 * Obtiene un club por ID con todos sus detalles
 * Ruta: GET /api/club/:id
 */
const getClubById = async (req, res) => {
  try {
    const clubId = Number(req.params.id);
    if (!clubId) {
      return res.status(400).json({ success: false, message: "ID inválido" });
    }

    const club = await prisma.club.findUnique({
      where: { id: clubId },
      include: {
        clubBooks: {
          include: { 
            book: {
              include: { categorias: true }
            },
            addedBy: true
          }
        },
        solicitudes: {
          include: { user: true }
        },
        memberships: {
          include: {
            user: true
          }
        }
      }
    });

    if (!club) {
      return res.status(404).json({ success: false, message: "Club no encontrado" });
    }
    
    const solicitudes = club.solicitudes ? club.solicitudes.map(s => ({
      id: s.id,
      username: s.user.username,
      avatar: s.user.avatar,
      estado: s.estado,
      fecha_solicitud: s.createdAt
    })) : [];
    
    let ownerName = null;
    if (club.owner) {
      ownerName = club.owner.username;
    } else {
      const ownerUser = await prisma.user.findUnique({ where: { id: club.id_owner } });
      ownerName = ownerUser ? ownerUser.username : null;
    }
    
    res.json({
      success: true,
      club: {
        id: club.id,
        name: club.name,
        description: club.description,
        id_owner: club.id_owner,
        ownerName,
        imagen: club.imagen,
        readBooks: club.clubBooks.map(clubBook => ({
          clubBookId: clubBook.id,
          id: clubBook.book.id,
          title: clubBook.book.title,
          author: clubBook.book.author,
          portada: clubBook.book.portada,
          id_api: clubBook.book.id_api,
          estado: clubBook.estado,
          addedAt: clubBook.addedAt,
          addedBy: clubBook.addedBy.username,
          categorias: clubBook.book.categorias ? clubBook.book.categorias.map(cat => ({ id: cat.id, nombre: cat.nombre })) : []
        })),
        solicitudes,
        members: club.memberships ? club.memberships.map(membership => ({ 
          id: membership.user.id, 
          username: membership.user.username,
          role: membership.role,
          level: membership.user.level,
          avatar: membership.user.avatar
        })) : []
      },
    });
  } catch (error) {
    console.error("[ERROR] Error al buscar club:", error);
    res.status(500).json({ success: false, message: "Error al buscar club" });
  }
};

/**
 * Crea una solicitud para unirse a un club
 * Ruta: POST /api/club/join
 */
const joinClub = async (req, res) => {
  try {
    const { clubId, username } = req.body;
    
    const missingFields = validateRequiredFields(['clubId', 'username'], req.body);
    if (missingFields) {
      return res.status(400).json({ success: false, message: "Faltan datos requeridos" });
    }

    const user = await prisma.user.findUnique({ where: { username } });
    if (!user) {
      return res.status(404).json({ success: false, message: "Usuario no encontrado" });
    }

    const solicitudExistente = await prisma.clubSolicitud.findFirst({
      where: { clubId: Number(clubId), userId: user.id, estado: "pendiente" }
    });
    if (solicitudExistente) {
      return res.json({ success: false, message: "Ya tienes una solicitud pendiente" });
    }

    const existingMembership = await prisma.clubMember.findUnique({
      where: {
        userId_clubId: {
          userId: user.id,
          clubId: Number(clubId)
        }
      }
    });
    if (existingMembership) {
      return res.json({ success: false, message: "Ya eres miembro del club" });
    }

    const solicitud = await prisma.clubSolicitud.create({
      data: {
        clubId: Number(clubId),
        userId: user.id,
        estado: "pendiente"
      }
    });
    res.json({ success: true, message: "Solicitud enviada", solicitud });
  } catch (error) {
    console.error("[ERROR] Error al crear solicitud:", error);
    res.status(500).json({ success: false, message: "Error del servidor" });
  }
};

/**
 * Acepta o rechaza una solicitud de membresía
 * Ruta: POST /api/club/:clubId/solicitud/:solicitudId
 */
const manageMembershipRequest = async (req, res) => {
  try {
    const clubId = Number(req.params.clubId);
    const solicitudId = Number(req.params.solicitudId);
    const { aceptar } = req.body;

    if (!clubId || !solicitudId || typeof aceptar !== "boolean") {
      return res.status(400).json({ success: false, message: "Faltan datos" });
    }

    const solicitud = await prisma.clubSolicitud.findUnique({
      where: { id: solicitudId },
      include: { user: true, club: true }
    });

    if (!solicitud || solicitud.clubId !== clubId) {
      return res.status(404).json({ success: false, message: "Solicitud no encontrada" });
    }

    if (solicitud.estado !== "pendiente") {
      return res.status(400).json({ success: false, message: "La solicitud ya fue gestionada" });
    }

    const nuevoEstado = aceptar ? "aceptada" : "rechazada";
    await prisma.clubSolicitud.update({
      where: { id: solicitudId },
      data: { estado: nuevoEstado }
    });

    if (aceptar) {
      await prisma.clubMember.create({
        data: {
          userId: solicitud.userId,
          clubId: clubId,
          role: 'LECTOR'
        }
      });
      
      try {
        await crearNotificacion(
          solicitud.userId,
          'SOLICITUD_ACEPTADA',
          '✅ Solicitud aceptada',
          `Tu solicitud para unirte a "${solicitud.club.name}" ha sido aceptada. ¡Bienvenido!`,
          { 
            clubId: clubId, 
            clubName: solicitud.club.name 
          }
        );
        
        await otorgarXP(solicitud.userId, 'UNIRSE_CLUB');
      } catch (notifError) {
        console.error('[ERROR] Error al enviar notificación de solicitud aceptada:', notifError.message);
      }
    } else {
      try {
        await crearNotificacion(
          solicitud.userId,
          'SOLICITUD_RECHAZADA',
          '❌ Solicitud rechazada',
          `Tu solicitud para unirte a "${solicitud.club.name}" ha sido rechazada.`,
          { 
            clubId: clubId, 
            clubName: solicitud.club.name 
          }
        );
      } catch (notifError) {
        console.error('[ERROR] Error al enviar notificación de solicitud rechazada:', notifError.message);
      }
    }

    res.json({ success: true, message: aceptar ? "Usuario agregado al club" : "Solicitud rechazada" });
  } catch (error) {
    console.error("[ERROR] Error al gestionar solicitud:", error);
    res.status(500).json({ success: false, message: "Error del servidor" });
  }
};

/**
 * Elimina un miembro del club
 * Ruta: DELETE /api/club/:clubId/member/:userId
 */
const removeMember = async (req, res) => {
  try {
    const clubId = Number(req.params.clubId);
    const userId = Number(req.params.userId);

    const club = await prisma.club.findUnique({ where: { id: clubId } });
    if (club.id_owner === userId) {
      return res.status(400).json({ success: false, message: "No puedes eliminar al moderador" });
    }

    await prisma.clubMember.delete({
      where: {
        userId_clubId: {
          userId: userId,
          clubId: clubId
        }
      }
    });

    res.json({ success: true, message: "Usuario eliminado del club" });
  } catch (error) {
    console.error("[ERROR] Error al eliminar usuario:", error);
    res.status(500).json({ success: false, message: "Error al eliminar usuario" });
  }
};

/**
 * Obtiene información de usuarios con roles (debug)
 * Ruta: GET /api/club/:clubId/debug/roles
 */
const debugUsersWithRoles = async (req, res) => {
  try {
    const { clubId } = req.params;
    
    const clubMembers = await prisma.clubMember.findMany({
      where: { clubId: parseInt(clubId) },
      include: {
        user: true,
        club: true
      }
    });
    
    const club = await prisma.club.findUnique({
      where: { id: parseInt(clubId) }
    });
    
    res.json({
      success: true,
      clubId: parseInt(clubId),
      totalMembers: clubMembers.length,
      members: clubMembers.map(membership => ({
        userId: membership.user.id,
        username: membership.user.username,
        role: membership.role,
        joinedAt: membership.joinedAt
      })),
      clubInfo: club ? {
        name: club.name,
        legacyOwnerId: club.id_owner
      } : null
    });
    
  } catch (error) {
    console.error('[ERROR] Error al obtener usuarios con roles:', error);
    res.status(500).json({ 
      success: false, 
      message: "Error al obtener usuarios con roles",
      error: error.message 
    });
  }
};

/**
 * Cambia el rol de un miembro del club
 * Ruta: PUT /api/club/:clubId/member/:userId/role
 */
const changeUserRole = async (req, res) => {
  try {
    const clubId = Number(req.params.clubId);
    const userId = Number(req.params.userId);
    const { newRole } = req.body;

    if (!['OWNER', 'MODERADOR', 'LECTOR'].includes(newRole)) {
      return res.status(400).json({ 
        success: false, 
        message: "Rol inválido. Debe ser OWNER, MODERADOR o LECTOR" 
      });
    }

    const club = await prisma.club.findUnique({ where: { id: clubId } });
    if (!club) {
      return res.status(404).json({ success: false, message: "Club no encontrado" });
    }

    const existingMembership = await prisma.clubMember.findUnique({
      where: {
        userId_clubId: {
          userId: userId,
          clubId: clubId
        }
      },
      include: {
        user: true
      }
    });

    if (!existingMembership) {
      return res.status(404).json({ 
        success: false, 
        message: "El usuario no es miembro del club" 
      });
    }

    if (club.id_owner === userId && newRole !== 'OWNER') {
      return res.status(400).json({ 
        success: false, 
        message: "No puedes cambiar el rol del propietario original del club" 
      });
    }

    const updatedMembership = await prisma.clubMember.update({
      where: {
        userId_clubId: {
          userId: userId,
          clubId: clubId
        }
      },
      data: {
        role: newRole
      },
      include: {
        user: true
      }
    });

    res.json({
      success: true,
      message: `Rol de ${updatedMembership.user.username} actualizado a ${newRole}`,
      member: {
        id: updatedMembership.user.id,
        username: updatedMembership.user.username,
        role: updatedMembership.role
      }
    });

  } catch (error) {
    console.error('[ERROR] Error al cambiar rol del usuario:', error);
    res.status(500).json({ 
      success: false, 
      message: "Error del servidor al cambiar el rol",
      error: error.message 
    });
  }
};

module.exports = {
  createClub,
  deleteClub,
  getAllClubs,
  getClubById,
  joinClub,
  manageMembershipRequest,
  removeMember,
  debugUsersWithRoles,
  changeUserRole
};