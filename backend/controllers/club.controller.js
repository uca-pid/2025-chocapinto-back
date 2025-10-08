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

    const club = await prisma.club.create({
      data: {
        name,
        description,
        id_owner: owner.id,
        imagen: imagen || defaultImg,
        members: {
          connect: { id: owner.id }
        }
      },
      include: { members: true }
    });

    res.json({ success: true, club });
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

    await prisma.club.delete({ where: { id: clubId } });
    res.json({ success: true, message: "Club eliminado" });
  } catch (error) {
    console.error("Error al eliminar club:", error);
    res.status(500).json({ success: false, message: "Error del servidor" });
  }
};

const getAllClubs = async (req, res) => {
  try {
    const clubs = await prisma.club.findMany({
      include: { members: true }
    });
    res.json({ success: true, clubs });
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
        members: true
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
        members: club.members ? club.members.map(m => ({ id: m.id, username: m.username })) : []
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
    const club = await prisma.club.findUnique({
      where: { id: Number(clubId) },
      include: { members: true }
    });
    if (club.members.some(m => m.id === user.id)) {
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
      await prisma.club.update({
        where: { id: clubId },
        data: { members: { connect: { id: solicitud.userId } } }
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

    await prisma.club.update({
      where: { id: clubId },
      data: { members: { disconnect: { id: userId } } }
    });

    res.json({ success: true, message: "Usuario eliminado del club" });
  } catch (error) {
    console.error("Error al eliminar usuario:", error);
    res.status(500).json({ success: false, message: "Error al eliminar usuario" });
  }
};

module.exports = {
  createClub,
  deleteClub,
  getAllClubs,
  getClubById,
  joinClub,
  manageMembershipRequest,
  removeMember
};