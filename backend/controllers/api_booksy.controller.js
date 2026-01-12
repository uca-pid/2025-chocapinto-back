// API Booksy Controller - Integración con sistema externo
const prisma = require('../db');

// Función para agregar metadatos de API
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
 * Obtiene usuarios con sus cursos/libros en cada club
 * Incluye: email del usuario, cursos con id_api, y porcentaje de avance
 * Solo accesible para sistemas externos autenticados
 */
const getUsersWithCourses = async (req, res) => {
  try {
    // Obtener todos los usuarios con sus membresías de clubes activos
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
                      id_api: {
                        not: null
                      }
                    }
                  },
                  include: {
                    book: true
                  }
                }
              }
            }
          }
        },
        readingHistory: {
          where: {
            book: {
              author: 'señasApp',
              id_api: {
                not: null
              }
            }
          },
          include: {
            book: true,
            club: true
          }
        }
      }
    });

    // Transformar datos para la API externa
    const usersWithCourses = users.map(user => {
      const userCourses = [];
      
      // Procesar cada membresía de club
      user.memberships.forEach(membership => {
        const club = membership.club;
        
        // Obtener cursos de señasApp en este club
        club.clubBooks.forEach(clubBook => {
          const book = clubBook.book;
          
          // Solo procesar cursos de señasApp con id_api
          if (book.author === 'señasApp' && book.id_api) {
            // Usar el estado del ClubBook directamente
            const status = clubBook.estado || 'por_leer';
            let progressPercentage = 0;
            
            // Calcular porcentaje basado en el estado del ClubBook
            if (status === 'leido') {
              progressPercentage = 100;
            } else if (status === 'leyendo') {
              // Si está leyendo, calcular progreso basado en tiempo transcurrido
              const now = new Date();
              const startDate = new Date(clubBook.addedAt);
              const daysDiff = Math.floor((now - startDate) / (1000 * 60 * 60 * 24));
              // Estimación: 30 días = 100% de progreso
              progressPercentage = Math.min(Math.round((daysDiff / 30) * 100), 95);
              if (progressPercentage < 5) progressPercentage = 5; // Mínimo 5% si está leyendo
            }
            // por_leer = 0% (ya está inicializado)

            userCourses.push({
              courseId: book.id_api,
              courseTitle: book.title,
              courseAuthor: book.author,
              clubId: club.id,
              clubName: club.name,
              status: status,
              progressPercentage: progressPercentage,
              startDate: clubBook.addedAt, // Fecha cuando se agregó al club
              endDate: status === 'leido' ? new Date() : null,
              lastUpdate: clubBook.addedAt,
              addedToClub: clubBook.addedAt,
              bookState: clubBook.estado // Debug info
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
        activeCourses: userCourses.filter(course => course.status === 'leyendo').length,
        completedCourses: userCourses.filter(course => course.status === 'leido').length,
        courses: userCourses
      };
    });

    // Filtrar solo usuarios que tienen cursos activos
    const activeUsers = usersWithCourses.filter(user => user.totalCourses > 0);

    console.log('📡 API Externa solicita todos los usuarios con cursos');
    
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
    console.error("❌ Error en API Externa:", error);
    res.status(500).json(addAPIMetadata(req, {
      success: false,
      message: "Error del servidor al procesar la solicitud",
      error: "INTERNAL_SERVER_ERROR"
    }));
  }
};

/**
 * Obtiene estadísticas generales de cursos por club
 */
const getClubCourseStats = async (req, res) => {
  try {
    const clubs = await prisma.club.findMany({
      include: {
        clubBooks: {
          where: {
            book: {
              author: 'señasApp',
              id_api: {
                not: null
              }
            }
          },
          include: {
            book: true
          }
        },
        memberships: true,
        readingHistory: {
          where: {
            book: {
              author: 'señasApp',
              id_api: {
                not: null
              }
            }
          },
          include: {
            book: true
          }
        }
      }
    });

    const clubStats = clubs.map(club => {
      const totalCourses = club.clubBooks.length;
      
      // Contar cursos activos y completados basado en el estado del ClubBook
      let activeCourses = 0;
      let completedCourses = 0;
      
      club.clubBooks.forEach(clubBook => {
        if (clubBook.estado === 'leyendo') {
          activeCourses++;
        } else if (clubBook.estado === 'leido') {
          completedCourses++;
        }
      });
      
      return {
        clubId: club.id,
        clubName: club.name,
        totalMembers: club.memberships.length,
        totalCourses: totalCourses,
        activeCourses: activeCourses,
        completedCourses: completedCourses,
        averageProgress: totalCourses > 0 ? Math.round((completedCourses / totalCourses) * 100) : 0
      };
    });

    console.log('📡 API Externa solicita estadísticas de clubes');
    
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
    console.error("❌ Error en API Externa:", error);
    res.status(500).json(addAPIMetadata(req, {
      success: false,
      message: "Error del servidor",
      error: "INTERNAL_SERVER_ERROR"
    }));
  }
};

/**
 * Obtiene información específica de un usuario con sus cursos
 */
const getUserCoursesById = async (req, res) => {
  try {
    const { userId } = req.params;

    // Primero obtener el usuario con toda su información de debug
    const user = await prisma.user.findUnique({
      where: { id: parseInt(userId) },
      include: {
        memberships: {
          include: {
            club: {
              include: {
                clubBooks: {
                  include: {
                    book: true
                  }
                }
              }
            }
          }
        },
        readingHistory: {
          include: {
            book: true,
            club: true
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

    // Debug: información completa para diagnóstico
    console.log(`🔍 DEBUG Usuario ${userId}:`);
    console.log(`- Membresías: ${user.memberships.length}`);
    console.log(`- Historial de lectura: ${user.readingHistory.length}`);
    
    user.memberships.forEach(membership => {
      console.log(`- Club ${membership.club.id} (${membership.club.name}): ${membership.club.clubBooks.length} libros`);
      membership.club.clubBooks.forEach(clubBook => {
        console.log(`  - Libro: "${clubBook.book.title}" (id_api: ${clubBook.book.id_api})`);
      });
    });

    user.readingHistory.forEach(history => {
      console.log(`- Historia: "${history.book.title}" en club ${history.clubId} - Estado: ${history.estado} (id_api: ${history.book.id_api})`);
    });

    // Procesar cursos del usuario específico
    const userCourses = [];
    const allBooksInClubs = []; // Para debug
    
    // Procesar cada membresía de club del usuario
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
        
        // Solo procesar cursos de señasApp con id_api
        if (book.author === 'señasApp' && book.id_api) {
          // Usar el estado del ClubBook directamente
          const status = clubBook.estado || 'por_leer';
          let progressPercentage = 0;
          
          // Calcular porcentaje basado en el estado del ClubBook
          if (status === 'leido') {
            progressPercentage = 100;
          } else if (status === 'leyendo') {
            // Si está leyendo, calcular progreso basado en tiempo transcurrido
            const now = new Date();
            const startDate = new Date(clubBook.addedAt);
            const daysDiff = Math.floor((now - startDate) / (1000 * 60 * 60 * 24));
            // Estimación: 30 días = 100% de progreso
            progressPercentage = Math.min(Math.round((daysDiff / 30) * 100), 95);
            if (progressPercentage < 5) progressPercentage = 5; // Mínimo 5% si está leyendo
          }
          // por_leer = 0% (ya está inicializado)

          userCourses.push({
            courseId: book.id_api,
            courseTitle: book.title,
            courseAuthor: book.author,
            clubId: club.id,
            clubName: club.name,
            status: status,
            progressPercentage: progressPercentage,
            startDate: clubBook.addedAt,
            endDate: status === 'leido' ? new Date() : null,
            lastUpdate: clubBook.addedAt,
            addedToClub: clubBook.addedAt,
            bookState: clubBook.estado,
            hasHistory: false // Ya no usamos readingHistory
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
        activeCourses: userCourses.filter(course => course.status === 'leyendo').length,
        completedCourses: userCourses.filter(course => course.status === 'leido').length,
        courses: userCourses,
        // Debug info (solo en desarrollo)
        ...(process.env.NODE_ENV === 'development' && {
          debug: {
            totalMemberships: user.memberships.length,
            totalHistoryRecords: user.readingHistory.length,
            allBooksInClubs: allBooksInClubs,
            senasAppBooksInClubs: allBooksInClubs.filter(b => b.author === 'señasApp' && b.id_api)
          }
        })
      }
    };

    console.log(`📡 API Externa solicita cursos del usuario ${userId}`);
    res.json(addAPIMetadata(req, responseData));

  } catch (error) {
    console.error("❌ Error en API Externa:", error);
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
