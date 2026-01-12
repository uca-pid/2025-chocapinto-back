// API Booksy Controller - Integración con sistema externo
const prisma = require('../db');

/**
 * Agrega metadatos de API a la respuesta
 */
const addAPIMetadata = (req, data) => ({
  ...data,
  apiInfo: {
    version: "1.0",
    timestamp: new Date().toISOString(),
    source: req.externalAPI?.source || 'unknown',
    requestId: `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }
});

/**
 * Calcula el porcentaje de progreso de un curso según su estado
 */
const calculateProgress = (estado, addedAt) => {
  if (estado === 'leido') {
    return 100;
  }
  
  if (estado === 'leyendo') {
    const now = new Date();
    const startDate = new Date(addedAt);
    const daysDiff = Math.floor((now - startDate) / (1000 * 60 * 60 * 24));
    const progressPercentage = Math.min(Math.round((daysDiff / 30) * 100), 95);
    return progressPercentage < 5 ? 5 : progressPercentage;
  }
  
  return 0; // por_leer
};

/**
 * Obtiene usuarios con sus cursos/libros en cada club
 * Ruta: GET /api/external/users/courses
 * Solo accesible para sistemas externos autenticados
 */
const getUsersWithCourses = async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      include: {
        memberships: {
          include: {
            club: {
              include: {
                clubBooks: {
                  where: {
                    book: {
                      author: 'señasApp',
                      id_api: { not: null }
                    }
                  },
                  include: { book: true }
                }
              }
            }
          }
        }
      }
    });

    const usersWithCourses = users.map(user => {
      const userCourses = [];
      
      user.memberships.forEach(membership => {
        const club = membership.club;
        
        club.clubBooks.forEach(clubBook => {
          const book = clubBook.book;
          
          if (book.author === 'señasApp' && book.id_api) {
            const status = clubBook.estado || 'por_leer';
            const progressPercentage = calculateProgress(status, clubBook.addedAt);

            userCourses.push({
              courseId: book.id_api,
              courseTitle: book.title,
              courseAuthor: book.author,
              clubId: club.id,
              clubName: club.name,
              status,
              progressPercentage,
              startDate: clubBook.addedAt,
              endDate: status === 'leido' ? new Date() : null,
              lastUpdate: clubBook.addedAt,
              addedToClub: clubBook.addedAt
            });
          }
        });
      });

      return {
        userId: user.id,
        username: user.username,
        email: user.email || null,
        level: user.level,
        xp: user.xp,
        totalCourses: userCourses.length,
        activeCourses: userCourses.filter(c => c.status === 'leyendo').length,
        completedCourses: userCourses.filter(c => c.status === 'leido').length,
        courses: userCourses
      };
    });

    const activeUsers = usersWithCourses.filter(user => user.totalCourses > 0);
    
    const responseData = {
      success: true,
      message: "Datos de usuarios con cursos obtenidos exitosamente",
      data: {
        totalUsers: activeUsers.length,
        users: activeUsers
      }
    };

    res.json(addAPIMetadata(req, responseData));

  } catch (error) {
    console.error("[ERROR] API Externa - getUsersWithCourses:", error);
    res.status(500).json(addAPIMetadata(req, {
      success: false,
      message: "Error del servidor al procesar la solicitud",
      error: "INTERNAL_SERVER_ERROR"
    }));
  }
};

/**
 * Obtiene estadísticas generales de cursos por club
 * Ruta: GET /api/external/clubs/stats
 */
const getClubCourseStats = async (req, res) => {
  try {
    const clubs = await prisma.club.findMany({
      include: {
        clubBooks: {
          where: {
            book: {
              author: 'señasApp',
              id_api: { not: null }
            }
          },
          include: { book: true }
        },
        memberships: true
      }
    });

    const clubStats = clubs.map(club => {
      const totalCourses = club.clubBooks.length;
      const activeCourses = club.clubBooks.filter(cb => cb.estado === 'leyendo').length;
      const completedCourses = club.clubBooks.filter(cb => cb.estado === 'leido').length;
      
      return {
        clubId: club.id,
        clubName: club.name,
        totalMembers: club.memberships.length,
        totalCourses,
        activeCourses,
        completedCourses,
        averageProgress: totalCourses > 0 ? Math.round((completedCourses / totalCourses) * 100) : 0
      };
    });
    
    const responseData = {
      success: true,
      message: "Estadísticas de cursos por club obtenidas exitosamente",
      data: {
        totalClubs: clubStats.length,
        clubs: clubStats
      }
    };

    res.json(addAPIMetadata(req, responseData));

  } catch (error) {
    console.error("[ERROR] API Externa - getClubCourseStats:", error);
    res.status(500).json(addAPIMetadata(req, {
      success: false,
      message: "Error del servidor",
      error: "INTERNAL_SERVER_ERROR"
    }));
  }
};

/**
 * Obtiene información específica de un usuario con sus cursos
 * Ruta: GET /api/external/users/:userId/courses
 */
const getUserCoursesById = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await prisma.user.findUnique({
      where: { id: parseInt(userId) },
      include: {
        memberships: {
          include: {
            club: {
              include: {
                clubBooks: {
                  include: { book: true }
                }
              }
            }
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

    const userCourses = [];
    const allBooksInClubs = [];
    
    user.memberships.forEach(membership => {
      const club = membership.club;
      
      club.clubBooks.forEach(clubBook => {
        const book = clubBook.book;
        
        allBooksInClubs.push({
          title: book.title,
          author: book.author,
          id_api: book.id_api,
          clubId: club.id,
          clubName: club.name
        });
        
        if (book.author === 'señasApp' && book.id_api) {
          const status = clubBook.estado || 'por_leer';
          const progressPercentage = calculateProgress(status, clubBook.addedAt);

          userCourses.push({
            courseId: book.id_api,
            courseTitle: book.title,
            courseAuthor: book.author,
            clubId: club.id,
            clubName: club.name,
            status,
            progressPercentage,
            startDate: clubBook.addedAt,
            endDate: status === 'leido' ? new Date() : null,
            lastUpdate: clubBook.addedAt,
            addedToClub: clubBook.addedAt
          });
        }
      });
    });

    const responseData = {
      success: true,
      message: "Cursos del usuario obtenidos exitosamente",
      data: {
        userId: user.id,
        username: user.username,
        email: user.email,
        level: user.level,
        xp: user.xp,
        totalCourses: userCourses.length,
        activeCourses: userCourses.filter(c => c.status === 'leyendo').length,
        completedCourses: userCourses.filter(c => c.status === 'leido').length,
        courses: userCourses,
        ...(process.env.NODE_ENV === 'development' && {
          debug: {
            totalMemberships: user.memberships.length,
            allBooksInClubs,
            senasAppBooksInClubs: allBooksInClubs.filter(b => b.author === 'señasApp' && b.id_api)
          }
        })
      }
    };
    
    res.json(addAPIMetadata(req, responseData));

  } catch (error) {
    console.error("[ERROR] API Externa - getUserCoursesById:", error);
    res.status(500).json(addAPIMetadata(req, {
      success: false,
      message: "Error del servidor",
      error: "INTERNAL_SERVER_ERROR"
    }));
  }
};

module.exports = {
  getUsersWithCourses,
  getClubCourseStats,
  getUserCoursesById
};
