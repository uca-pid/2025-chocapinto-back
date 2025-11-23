// routes/api_booksy.routes.js
const express = require('express');
const router = express.Router();
const { 
  getUsersWithCourses, 
  getClubCourseStats,
  getUserCoursesById
} = require('../controllers/api_booksy.controller');
const { authenticateExternalAPI } = require('../middleware/apiAuth.middleware');

// 🔒 Aplicar autenticación a TODAS las rutas de la API Booksy
router.use(authenticateExternalAPI);

// Rutas protegidas para sistemas externos

/**
 * GET /api/booksy/users
 * Obtiene todos los usuarios con sus cursos/libros en cada club
 * Incluye: email, cursos con id_api, porcentaje de avance
 */
router.get('/users', getUsersWithCourses);

/**
 * GET /api/booksy/users/:userId
 * Obtiene información específica de un usuario con sus cursos
 */
router.get('/users/:userId', getUserCoursesById);

/**
 * GET /api/booksy/clubs/stats
 * Obtiene estadísticas generales de cursos por club
 */
router.get('/clubs/stats', getClubCourseStats);

module.exports = router;