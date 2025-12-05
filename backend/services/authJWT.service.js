const jwt = require('jsonwebtoken');
const crypto = require('crypto');

class AuthJWTService {
  constructor() {
    this.JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-key-change-in-production';
    this.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'your-refresh-secret-key';
    this.JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';
    this.REFRESH_EXPIRES_IN = process.env.REFRESH_EXPIRES_IN || '7d';
    
    // Clientes autorizados para OAuth 2.0 Client Credentials
    this.authorizedClients = {
      'booksy-client': {
        id: 'booksy-client',
        secret: process.env.BOOKSY_CLIENT_SECRET || 'booksy-secret-2025',
        scopes: ['read', 'write'],
        name: 'Booksy Platform'
      },
      'external-system': {
        id: 'external-system',
        secret: process.env.EXTERNAL_CLIENT_SECRET || 'external-secret-123',
        scopes: ['read'],
        name: 'External System'
      }
    };
  }

  // Generar Access Token JWT
  generateAccessToken(clientId, scopes = []) {
    const payload = {
      client_id: clientId,
      scopes: scopes,
      type: 'access_token',
      iat: Math.floor(Date.now() / 1000),
    };

    return jwt.sign(payload, this.JWT_SECRET, { 
      expiresIn: this.JWT_EXPIRES_IN,
      issuer: 'booksy-club-api',
      audience: 'external-clients'
    });
  }

  // Generar Refresh Token
  generateRefreshToken(clientId) {
    const payload = {
      client_id: clientId,
      type: 'refresh_token',
      jti: crypto.randomUUID(), // JWT ID único
      iat: Math.floor(Date.now() / 1000),
    };

    return jwt.sign(payload, this.JWT_REFRESH_SECRET, { 
      expiresIn: this.REFRESH_EXPIRES_IN,
      issuer: 'booksy-club-api',
      audience: 'external-clients'
    });
  }

  // Verificar Access Token
  verifyAccessToken(token) {
    try {
      const decoded = jwt.verify(token, this.JWT_SECRET);
      
      if (decoded.type !== 'access_token') {
        throw new Error('Token type invalid');
      }

      return {
        valid: true,
        decoded,
        client_id: decoded.client_id,
        scopes: decoded.scopes || []
      };
    } catch (error) {
      return {
        valid: false,
        error: error.message,
        code: this.getErrorCode(error)
      };
    }
  }

  // Verificar Refresh Token
  verifyRefreshToken(token) {
    try {
      const decoded = jwt.verify(token, this.JWT_REFRESH_SECRET);
      
      if (decoded.type !== 'refresh_token') {
        throw new Error('Token type invalid');
      }

      return {
        valid: true,
        decoded,
        client_id: decoded.client_id
      };
    } catch (error) {
      return {
        valid: false,
        error: error.message,
        code: this.getErrorCode(error)
      };
    }
  }

  // Validar credenciales de cliente (OAuth 2.0 Client Credentials)
  validateClientCredentials(clientId, clientSecret) {
    const client = this.authorizedClients[clientId];
    
    if (!client) {
      return {
        valid: false,
        error: 'Client not found'
      };
    }

    if (client.secret !== clientSecret) {
      return {
        valid: false,
        error: 'Invalid client secret'
      };
    }

    return {
      valid: true,
      client: client
    };
  }

  // Obtener información del token decodificado
  getTokenInfo(token) {
    try {
      // Decodificar sin verificar (solo para inspección)
      const decoded = jwt.decode(token, { complete: true });
      return {
        header: decoded.header,
        payload: decoded.payload,
        expires_at: new Date(decoded.payload.exp * 1000),
        issued_at: new Date(decoded.payload.iat * 1000)
      };
    } catch (error) {
      return null;
    }
  }

  // Mapear errores JWT a códigos OAuth 2.0
  getErrorCode(error) {
    if (error.name === 'TokenExpiredError') {
      return 'invalid_token';
    }
    if (error.name === 'JsonWebTokenError') {
      return 'invalid_token';
    }
    if (error.name === 'NotBeforeError') {
      return 'invalid_token';
    }
    return 'invalid_request';
  }

  // Generar par de tokens completo
  generateTokenPair(clientId, scopes) {
    return {
      access_token: this.generateAccessToken(clientId, scopes),
      refresh_token: this.generateRefreshToken(clientId),
      token_type: 'Bearer',
      expires_in: this.parseExpiresIn(this.JWT_EXPIRES_IN),
      scope: scopes.join(' ')
    };
  }

  // Parsear tiempo de expiración a segundos
  parseExpiresIn(expiresIn) {
    if (typeof expiresIn === 'number') return expiresIn;
    
    const units = {
      's': 1,
      'm': 60,
      'h': 3600,
      'd': 86400
    };

    const match = expiresIn.match(/^(\d+)([smhd])$/);
    if (match) {
      return parseInt(match[1]) * units[match[2]];
    }
    
    return 86400; // Default 24 horas
  }
}

module.exports = new AuthJWTService();