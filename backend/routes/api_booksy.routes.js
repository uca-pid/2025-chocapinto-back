// routes/api_booksy.routes.js
const express = require('express');
const router = express.Router();
const { 
  getUsersWithCourses, 
  getClubCourseStats,
  getUserCoursesById
} = require('../controllers/api_booksy.controller');

// Importar el nuevo middleware JWT
const { authenticateJWT, authenticateFlexible } = require('../middleware/jwtAuth.middleware');

// 🔒 Aplicar autenticación JWT a TODAS las rutas de la API Booksy
// Usar authenticateFlexible para mantener compatibilidad con API Keys existentes
router.use(authenticateFlexible(['read'])); // Requiere scope 'read'

// Rutas protegidas para sistemas externos

/**
 * GET /api/booksy/users
 * Obtiene todos los usuarios con sus cursos/libros en cada club
 * Incluye: email, cursos con id_api, porcentaje de avance
 */
router.get('/users', getUsersWithCourses);

/**
 * GET /api/booksy/users/:userId/courses
 * Obtiene cursos específicos de un usuario por su ID
 */
router.get('/users/:userId/courses', getUserCoursesById);

/**
 * GET /api/booksy/stats/club/:clubId
 * Estadísticas de progreso de lectura de un club específico
 */
router.get('/stats/club/:clubId', getClubCourseStats);

module.exports = router;