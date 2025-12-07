const express = require("express");
const router = express.Router();
const sesionController = require("../controllers/sesion.controller");
const { authenticateToken } = require("../middleware/jwtAuth.middleware");

// Todas las rutas requieren autenticación
router.use(authenticateToken);

// Crear sesión (solo moderadores/owner)
router.post("/", sesionController.crearSesion);

// Obtener sesiones de un club
router.get("/club/:clubId", sesionController.obtenerSesionesClub);

// Obtener sesión específica
router.get("/:sesionId", sesionController.obtenerSesion);

// Confirmar asistencia
router.post("/:sesionId/confirmar", sesionController.confirmarAsistencia);

// Registrar asistencia real (solo moderadores/owner)
router.post("/:sesionId/asistencia", sesionController.registrarAsistenciaReal);

// Obtener próximas sesiones del usuario
router.get("/usuario/proximas", sesionController.obtenerProximasSesionesUsuario);

// Actualizar sesión (solo moderadores/owner)
router.put("/:sesionId", sesionController.actualizarSesion);

// Eliminar sesión (solo moderadores/owner)
router.delete("/:sesionId", sesionController.eliminarSesion);

module.exports = router;
