const authJWTService = require('../services/authJWT.service.js');

/**
 * Middleware para autenticar tokens JWT (OAuth 2.0)
 * Valida access tokens y verifica scopes requeridos
 * @param {Array} requiredScopes - Scopes necesarios para acceder al recurso
 */
const authenticateJWT = (requiredScopes = []) => {
  return (req, res, next) => {
    try {
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

      const token = authHeader.substring(7);

      const verification = authJWTService.verifyAccessToken(token);
      
      if (!verification.valid) {
        return res.status(401).json({
          error: verification.code || 'invalid_token',
          error_description: verification.error || 'Token validation failed'
        });
      }

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

      req.jwtAuth = {
        client_id: verification.client_id,
        scopes: verification.scopes,
        token_info: verification.decoded,
        authenticated: true,
        auth_method: 'jwt_bearer'
      };

      next();

    } catch (error) {
      console.error('[ERROR] Error en autenticación JWT:', error);
      res.status(500).json({
        error: 'server_error',
        error_description: 'Internal authentication error'
      });
    }
  };
};

/**
 * Middleware flexible que acepta JWT o API Key
 * Prioriza JWT Bearer token, fallback a X-API-Key
 * @param {Array} requiredScopes - Scopes necesarios (solo para JWT)
 */
const authenticateFlexible = (requiredScopes = []) => {
  return (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const apiKey = req.headers['x-api-key'];

    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authenticateJWT(requiredScopes)(req, res, next);
    }

    if (apiKey) {
      const { authenticateExternalAPI } = require('./apiAuth.middleware');
      return authenticateExternalAPI(req, res, next);
    }

    return res.status(401).json({
      error: 'invalid_request',
      error_description: 'Authentication required. Use Bearer token or X-API-Key'
    });
  };
};

module.exports = {
  authenticateJWT,
  authenticateFlexible
};