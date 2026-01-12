// backend/middleware/userAuth.middleware.js
const userAuthService = require('../services/userAuth.service');

/**
 * Middleware para autenticar usuarios con JWT
 * Verifica que el usuario esté autenticado
 */
const authenticateUser = (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'No autorizado. Token requerido.'
      });
    }

    const token = authHeader.substring(7);
    const verification = userAuthService.verifyToken(token);
    
    if (!verification.valid) {
      return res.status(401).json({
        success: false,
        message: 'Token inválido o expirado'
      });
    }

    // Agregar info del usuario al request
    req.user = {
      userId: verification.userId,
      username: verification.username,
      role: verification.role
    };

    next();
  } catch (error) {
    console.error('[ERROR] Error en autenticación:', error);
    res.status(500).json({
      success: false,
      message: 'Error en autenticación'
    });
  }
};

/**
 * Middleware para verificar roles específicos
 * @param {Array} allowedRoles - Roles permitidos ['admin', 'moderator', 'reader']
 */
const authorizeRoles = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Usuario no autenticado'
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'No tienes permisos para realizar esta acción'
      });
    }

    next();
  };
};

module.exports = {
  authenticateUser,
  authorizeRoles
};