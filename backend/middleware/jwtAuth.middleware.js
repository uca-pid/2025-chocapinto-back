const authJWTService = require('../services/authJWT.service.js');

// Middleware principal para autenticar JWT tokens
const authenticateJWT = (requiredScopes = []) => {
  return (req, res, next) => {
    try {
      // 1. Extraer token del header Authorization
      const authHeader = req.headers['authorization'];
      
      if (!authHeader) {
        return res.status(401).json({
          error: 'invalid_request',
          error_description: 'Authorization header missing'
        });
      }

      if (!authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
          error: 'invalid_request',
          error_description: 'Invalid authorization header format. Use: Bearer <token>'
        });
      }

      const token = authHeader.substring(7); // Remover "Bearer "

      // 2. Verificar el token
      const verification = authJWTService.verifyAccessToken(token);
      
      if (!verification.valid) {
        return res.status(401).json({
          error: verification.code || 'invalid_token',
          error_description: verification.error || 'Token validation failed'
        });
      }

      // 3. Verificar scopes requeridos
      if (requiredScopes.length > 0) {
        const tokenScopes = verification.scopes || [];
        const hasRequiredScopes = requiredScopes.every(scope => tokenScopes.includes(scope));
        
        if (!hasRequiredScopes) {
          return res.status(403).json({
            error: 'insufficient_scope',
            error_description: `Required scopes: ${requiredScopes.join(', ')}. Token scopes: ${tokenScopes.join(', ')}`
          });
        }
      }

      // 4. Agregar información del cliente al request
      req.jwtAuth = {
        client_id: verification.client_id,
        scopes: verification.scopes,
        token_info: verification.decoded,
        authenticated: true,
        auth_method: 'jwt_bearer'
      };

      console.log(`🔐 JWT Auth: Cliente ${verification.client_id} con scopes [${verification.scopes.join(', ')}]`);
      next();

    } catch (error) {
      console.error('Error en autenticación JWT:', error);
      res.status(500).json({
        error: 'server_error',
        error_description: 'Internal authentication error'
      });
    }
  };
};

// Middleware para validar scopes específicos
const requireScope = (...scopes) => {
  return (req, res, next) => {
    if (!req.jwtAuth) {
      return res.status(401).json({
        error: 'invalid_request',
        error_description: 'Authentication required'
      });
    }

    const tokenScopes = req.jwtAuth.scopes || [];
    const hasAllScopes = scopes.every(scope => tokenScopes.includes(scope));

    if (!hasAllScopes) {
      return res.status(403).json({
        error: 'insufficient_scope',
        error_description: `Required scopes: ${scopes.join(', ')}`
      });
    }

    next();
  };
};

// Middleware opcional para permitir tanto API Key como JWT
const authenticateFlexible = (requiredScopes = []) => {
  return (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const apiKey = req.headers['x-api-key'];

    // Si hay Bearer token, usar JWT
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authenticateJWT(requiredScopes)(req, res, next);
    }

    // Si hay API Key, usar el middleware anterior (para compatibilidad)
    if (apiKey) {
      const { authenticateExternalAPI } = require('./apiAuth.middleware');
      return authenticateExternalAPI(req, res, next);
    }

    // No hay autenticación
    return res.status(401).json({
      error: 'invalid_request',
      error_description: 'Authentication required. Use Bearer token or X-API-Key'
    });
  };
};

module.exports = {
  authenticateJWT,
  requireScope,
  authenticateFlexible
};