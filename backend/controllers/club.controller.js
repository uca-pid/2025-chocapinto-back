// src/controllers/club.controller.js
const prisma = require('../db');
const { validateRequiredFields } = require('../utils/validateFields');

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

    const defaultImg = "https://img.lovepik.com/png/20231109/book-cartoon-illustration-school-start-reading-reading-book_539915_wh860.png";

    // Crear el club
    const club = await prisma.club.create({
      data: {
        name,
        description,
        id_owner: owner.id,
        imagen: imagen || defaultImg
      }
    });

    // Crear la membresía del owner con rol OWNER
    await prisma.clubMember.create({
      data: {
        userId: owner.id,
        clubId: club.id,
        role: 'OWNER'
      }
    });

    // Obtener el club con sus membresías para la respuesta
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

    // Formatear para mantener compatibilidad con el frontend
    const clubFormatted = {
  ...clubWithMembers,
  members: clubWithMembers.memberships.map(membership => ({
    ...membership.user,           // Esto ya incluye level y xp
    role: membership.role,        // Agregar el rol
    joinedAt: membership.joinedAt // Agregar fecha de unión
  }))
};

    res.json({ success: true, club: clubFormatted });
  } catch (error) {
    console.error("Error al crear club:", error);
    res.status(500).json({ success: false, message: "Error del servidor" });
  }
};

const deleteClub = async (req, res) => {
  try {
    const clubId = Number(req.params.id);
    if (!clubId) {
      return res.status(400).json({ success: false, message: "ID inválido" });
    }

    // Usar transacción para eliminar todo relacionado al club
    await prisma.$transaction(async (tx) => {
      // Eliminar memberships del club
      await tx.clubMember.deleteMany({
        where: { clubId: clubId }
      });
      
      // Eliminar solicitudes del club
      await tx.clubSolicitud.deleteMany({
        where: { clubId: clubId }
      });
      
      // Eliminar historial de lectura del club
      await tx.readingHistory.deleteMany({
        where: { clubId: clubId }
      });
      
      // Eliminar comentarios de libros del club
      const clubBooks = await tx.clubBook.findMany({
        where: { clubId: clubId }
      });
      
      for (const clubBook of clubBooks) {
        await tx.comment.deleteMany({
          where: { clubBookId: clubBook.id }
        });
      }
      
      // Eliminar libros del club
      await tx.clubBook.deleteMany({
        where: { clubId: clubId }
      });
      
      // Finalmente eliminar el club
      await tx.club.delete({ where: { id: clubId } });
    });

    res.json({ success: true, message: "Club eliminado correctamente" });
  } catch (error) {
    console.error("Error al eliminar club:", error);
    res.status(500).json({ success: false, message: "Error del servidor" });
  }
};

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
    
    // Transformar para mantener compatibilidad con el frontend
    const clubsFormatted = clubs.map(club => ({
  ...club,
  members: club.memberships.map(membership => ({
    ...membership.user,           // Incluye level, xp, etc.
    role: membership.role,
    joinedAt: membership.joinedAt
  }))
}));
    
    res.json({ success: true, clubs: clubsFormatted });
  } catch (error) {
    console.error("Error al obtener clubes:", error);
    res.status(500).json({ success: false, message: "Error del servidor" });
  }
};

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
            user: true,
            
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
      estado: s.estado,
      createdAt: s.createdAt
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
    console.error("Error al buscar club:", error);
    res.status(500).json({ success: false, message: "Error al buscar club" });
  }
};

// Continúo con más funciones del controlador...
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

    // Revisar si ya existe una solicitud pendiente
    const solicitudExistente = await prisma.clubSolicitud.findFirst({
      where: { clubId: Number(clubId), userId: user.id, estado: "pendiente" }
    });
    if (solicitudExistente) {
      return res.json({ success: false, message: "Ya tienes una solicitud pendiente" });
    }

    // Revisar si ya es miembro
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

    // Crear solicitud
    const solicitud = await prisma.clubSolicitud.create({
      data: {
        clubId: Number(clubId),
        userId: user.id,
        estado: "pendiente"
      }
    });
    res.json({ success: true, message: "Solicitud enviada", solicitud });
  } catch (error) {
    console.error("Error al crear solicitud:", error);
    res.status(500).json({ success: false, message: "Error del servidor" });
  }
};

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

    // Actualizar estado
    const nuevoEstado = aceptar ? "aceptada" : "rechazada";
    await prisma.clubSolicitud.update({
      where: { id: solicitudId },
      data: { estado: nuevoEstado }
    });

    // Si se acepta, agregar usuario al club
    if (aceptar) {
      await prisma.clubMember.create({
        data: {
          userId: solicitud.userId,
          clubId: clubId,
          role: 'LECTOR'
        }
      });
    }

    res.json({ success: true, message: aceptar ? "Usuario agregado al club" : "Solicitud rechazada" });
  } catch (error) {
    console.error("Error al gestionar solicitud:", error);
    res.status(500).json({ success: false, message: "Error del servidor" });
  }
};

const removeMember = async (req, res) => {
  try {
    const clubId = Number(req.params.clubId);
    const userId = Number(req.params.userId);

    // Verificar que el usuario a eliminar no sea el owner
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
    console.error("Error al eliminar usuario:", error);
    res.status(500).json({ success: false, message: "Error al eliminar usuario" });
  }
};

// Función de debug para ver usuarios con roles
const debugUsersWithRoles = async (req, res) => {
  try {
    const { clubId } = req.params;
    
    console.log('\n🔍 =========================');
    console.log('🔍 DEBUG USERS WITH ROLES');
    console.log('🔍 =========================');
    
    // Obtener todos los miembros del club directamente desde ClubMember
    const clubMembers = await prisma.clubMember.findMany({
      where: { clubId: parseInt(clubId) },
      include: {
        user: true,
        club: true
      }
    });
    
    console.log(`\n📋 Club ID: ${clubId}`);
    console.log(`📋 Total members found: ${clubMembers.length}\n`);
    
    clubMembers.forEach((membership, index) => {
      console.log(`${index + 1}. User: ${membership.user.username} (ID: ${membership.user.id})`);
      console.log(`   Role: ${membership.role}`);
      console.log(`   Joined: ${membership.joinedAt}`);
      console.log(`   ----------------`);
    });
    
    // También obtener info del club
    const club = await prisma.club.findUnique({
      where: { id: parseInt(clubId) }
    });
    
    if (club) {
      console.log(`\n🏛️  Club info:`);
      console.log(`   Name: ${club.name}`);
      console.log(`   Owner ID (legacy): ${club.id_owner}`);
      console.log(`   ----------------\n`);
    }
    
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
    console.error('❌ Error al obtener usuarios con roles:', error);
    res.status(500).json({ 
      success: false, 
      message: "Error al obtener usuarios con roles",
      error: error.message 
    });
  }
};

// Cambiar rol de un miembro del club
const changeUserRole = async (req, res) => {
  try {
    const clubId = Number(req.params.clubId);
    const userId = Number(req.params.userId);
    const { newRole } = req.body;

    console.log(`🔄 Cambiando rol del usuario ${userId} en club ${clubId} a: ${newRole}`);

    // Validar que el nuevo rol sea válido
    if (!['OWNER', 'MODERADOR', 'LECTOR'].includes(newRole)) {
      return res.status(400).json({ 
        success: false, 
        message: "Rol inválido. Debe ser OWNER, MODERADOR o LECTOR" 
      });
    }

    // Verificar que el club existe
    const club = await prisma.club.findUnique({ where: { id: clubId } });
    if (!club) {
      return res.status(404).json({ success: false, message: "Club no encontrado" });
    }

    // Verificar que el usuario existe como miembro del club
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

    // No permitir cambiar el rol del owner original
    if (club.id_owner === userId && newRole !== 'OWNER') {
      return res.status(400).json({ 
        success: false, 
        message: "No puedes cambiar el rol del propietario original del club" 
      });
    }

    // Actualizar el rol del usuario
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

    console.log(`✅ Rol actualizado exitosamente`);
    
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
    console.error('❌ Error al cambiar rol del usuario:', error);
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