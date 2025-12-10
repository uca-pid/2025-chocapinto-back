const authJWTService = require('../services/authJWT.service');

/**
 * Controlador para autenticación externa OAuth 2.0
 * Implementa Client Credentials Flow para integración con APIs externas
 */
class AuthExternalController {
  
  /**
   * Genera access token usando Client Credentials Flow
   * Ruta: POST /api/external/auth/token
   */
  async getAccessToken(req, res) {
    try {
      const { grant_type, client_id, client_secret, scope } = req.body;

      if (grant_type !== 'client_credentials') {
        return res.status(400).json({
          error: 'unsupported_grant_type',
          error_description: 'Only client_credentials grant type is supported'
        });
      }

      if (!client_id || !client_secret) {
        return res.status(400).json({
          error: 'invalid_request',
          error_description: 'client_id and client_secret are required'
        });
      }

      const clientValidation = authJWTService.validateClientCredentials(client_id, client_secret);
      
      if (!clientValidation.valid) {
        return res.status(401).json({
          error: 'invalid_client',
          error_description: clientValidation.error
        });
      }

      const requestedScopes = scope ? scope.split(' ') : [];
      const clientScopes = clientValidation.client.scopes;
      
      const invalidScopes = requestedScopes.filter(s => !clientScopes.includes(s));
      if (invalidScopes.length > 0) {
        return res.status(400).json({
          error: 'invalid_scope',
          error_description: `Invalid scopes: ${invalidScopes.join(', ')}. Available: ${clientScopes.join(', ')}`
        });
      }

      const finalScopes = requestedScopes.length > 0 ? requestedScopes : clientScopes;
      const tokens = authJWTService.generateTokenPair(client_id, finalScopes);

      res.json({
        access_token: tokens.access_token,
        token_type: tokens.token_type,
        expires_in: tokens.expires_in,
        scope: tokens.scope
      });

    } catch (error) {
      console.error('[ERROR] Error generando access token:', error);
      res.status(500).json({
        error: 'server_error',
        error_description: 'Internal server error during token generation'
      });
    }
  }

  /**
   * Refresca un access token existente
   * Ruta: POST /api/external/auth/refresh
   */
  async refreshToken(req, res) {
    try {
      const { grant_type, refresh_token } = req.body;

      if (grant_type !== 'refresh_token') {
        return res.status(400).json({
          error: 'unsupported_grant_type',
          error_description: 'Only refresh_token grant type is supported'
        });
      }

      if (!refresh_token) {
        return res.status(400).json({
          error: 'invalid_request',
          error_description: 'refresh_token is required'
        });
      }

      const verification = authJWTService.verifyRefreshToken(refresh_token);
      
      if (!verification.valid) {
        return res.status(401).json({
          error: 'invalid_grant',
          error_description: 'Invalid refresh token'
        });
      }

      const client_id = verification.client_id;
      const clientValidation = authJWTService.validateClientCredentials(client_id, '');
      
      if (!clientValidation.valid) {
        return res.status(401).json({
          error: 'invalid_client',
          error_description: 'Client not found'
        });
      }

      const newAccessToken = authJWTService.generateAccessToken(client_id, clientValidation.client.scopes);

      res.json({
        access_token: newAccessToken,
        token_type: 'Bearer',
        expires_in: authJWTService.parseExpiresIn(authJWTService.JWT_EXPIRES_IN),
        scope: clientValidation.client.scopes.join(' ')
      });

    } catch (error) {
      console.error('[ERROR] Error refrescando token:', error);
      res.status(500).json({
        error: 'server_error',
        error_description: 'Internal server error during token refresh'
      });
    }
  }

  /**
   * Inspecciona un token para verificar su validez (RFC 7662)
   * Ruta: POST /api/external/auth/introspect
   */
  async introspectToken(req, res) {
    try {
      const { token, token_type_hint } = req.body;

      if (!token) {
        return res.status(400).json({
          error: 'invalid_request',
          error_description: 'token parameter is required'
        });
      }

      let verification = authJWTService.verifyAccessToken(token);
      let tokenType = 'access_token';

      if (!verification.valid && token_type_hint !== 'access_token') {
        verification = authJWTService.verifyRefreshToken(token);
        tokenType = 'refresh_token';
      }

      if (!verification.valid) {
        return res.json({ active: false });
      }

      const tokenInfo = authJWTService.getTokenInfo(token);

      res.json({
        active: true,
        client_id: verification.client_id || verification.decoded.client_id,
        token_type: tokenType,
        exp: verification.decoded.exp,
        iat: verification.decoded.iat,
        scope: (verification.scopes || []).join(' '),
        sub: verification.client_id || verification.decoded.client_id
      });

    } catch (error) {
      console.error('[ERROR] Error introspecting token:', error);
      res.status(500).json({
        error: 'server_error',
        error_description: 'Internal server error during token introspection'
      });
    }
  }

  /**
   * Retorna metadata del servidor de autorización (RFC 8414)
   * Ruta: GET /api/external/auth/.well-known/oauth-authorization-server
   */
  async getAuthorizationServerMetadata(req, res) {
    try {
      const baseUrl = `${req.protocol}://${req.get('host')}`;
      
      res.json({
        issuer: baseUrl,
        token_endpoint: `${baseUrl}/api/external/auth/token`,
        token_introspection_endpoint: `${baseUrl}/api/external/auth/introspect`,
        grant_types_supported: ['client_credentials', 'refresh_token'],
        token_endpoint_auth_methods_supported: ['client_secret_post'],
        scopes_supported: ['read', 'write', 'admin'],
        response_types_supported: ['token'],
        service_documentation: `${baseUrl}/api/external/docs`
      });
    } catch (error) {
      console.error('[ERROR] Error getting server metadata:', error);
      res.status(500).json({
        error: 'server_error',
        error_description: 'Internal server error'
      });
    }
  }
}

module.exports = new AuthExternalController();