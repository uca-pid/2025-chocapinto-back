const authJWTService = require('../services/authJWT.service');

class AuthExternalController {
  
  // OAuth 2.0 Client Credentials Flow - Token Endpoint
  async getAccessToken(req, res) {
    try {
      const { grant_type, client_id, client_secret, scope } = req.body;

      // 1. Validar grant_type
      if (grant_type !== 'client_credentials') {
        return res.status(400).json({
          error: 'unsupported_grant_type',
          error_description: 'Only client_credentials grant type is supported'
        });
      }

      // 2. Validar client_id y client_secret
      if (!client_id || !client_secret) {
        return res.status(400).json({
          error: 'invalid_request',
          error_description: 'client_id and client_secret are required'
        });
      }

      // 3. Verificar credenciales del cliente
      const clientValidation = authJWTService.validateClientCredentials(client_id, client_secret);
      
      if (!clientValidation.valid) {
        return res.status(401).json({
          error: 'invalid_client',
          error_description: clientValidation.error
        });
      }

      // 4. Procesar scopes solicitados
      const requestedScopes = scope ? scope.split(' ') : [];
      const clientScopes = clientValidation.client.scopes;
      
      // Verificar que los scopes solicitados estén permitidos para el cliente
      const invalidScopes = requestedScopes.filter(s => !clientScopes.includes(s));
      if (invalidScopes.length > 0) {
        return res.status(400).json({
          error: 'invalid_scope',
          error_description: `Invalid scopes: ${invalidScopes.join(', ')}. Available: ${clientScopes.join(', ')}`
        });
      }

      // Usar todos los scopes del cliente si no se especifican
      const finalScopes = requestedScopes.length > 0 ? requestedScopes : clientScopes;

      // 5. Generar tokens
      const tokens = authJWTService.generateTokenPair(client_id, finalScopes);

      
      // 7. Respuesta OAuth 2.0 estándar
      res.json({
        access_token: tokens.access_token,
        token_type: tokens.token_type,
        expires_in: tokens.expires_in,
        scope: tokens.scope,
        // refresh_token: tokens.refresh_token, // Solo en casos específicos
      });

    } catch (error) {
      console.error('Error generando access token:', error);
      res.status(500).json({
        error: 'server_error',
        error_description: 'Internal server error during token generation'
      });
    }
  }

  // Endpoint para refrescar token (opcional)
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

      // Verificar refresh token
      const verification = authJWTService.verifyRefreshToken(refresh_token);
      
      if (!verification.valid) {
        return res.status(401).json({
          error: 'invalid_grant',
          error_description: 'Invalid refresh token'
        });
      }

      // Obtener cliente y generar nuevo access token
      const client_id = verification.client_id;
      const clientValidation = authJWTService.validateClientCredentials(client_id, ''); // Solo verificar existencia
      
      if (!clientValidation.valid) {
        return res.status(401).json({
          error: 'invalid_client',
          error_description: 'Client not found'
        });
      }

      // Generar nuevo access token
      const newAccessToken = authJWTService.generateAccessToken(client_id, clientValidation.client.scopes);

      res.json({
        access_token: newAccessToken,
        token_type: 'Bearer',
        expires_in: authJWTService.parseExpiresIn(authJWTService.JWT_EXPIRES_IN),
        scope: clientValidation.client.scopes.join(' ')
      });

    } catch (error) {
      console.error('Error refrescando token:', error);
      res.status(500).json({
        error: 'server_error',
        error_description: 'Internal server error during token refresh'
      });
    }
  }

  // Endpoint para inspeccionar token (RFC 7662)
  async introspectToken(req, res) {
    try {
      const { token, token_type_hint } = req.body;

      if (!token) {
        return res.status(400).json({
          error: 'invalid_request',
          error_description: 'token parameter is required'
        });
      }

      // Intentar verificar como access token
      let verification = authJWTService.verifyAccessToken(token);
      let tokenType = 'access_token';

      // Si falla, intentar como refresh token
      if (!verification.valid && token_type_hint !== 'access_token') {
        verification = authJWTService.verifyRefreshToken(token);
        tokenType = 'refresh_token';
      }

      if (!verification.valid) {
        return res.json({
          active: false
        });
      }

      // Obtener información adicional del token
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
      console.error('Error introspecting token:', error);
      res.status(500).json({
        error: 'server_error',
        error_description: 'Internal server error during token introspection'
      });
    }
  }

  // Información sobre el servidor de autorización (RFC 8414)
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
      console.error('Error getting server metadata:', error);
      res.status(500).json({
        error: 'server_error',
        error_description: 'Internal server error'
      });
    }
  }
}

module.exports = new AuthExternalController();