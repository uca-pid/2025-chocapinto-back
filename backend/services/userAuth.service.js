// backend/services/userAuth.service.js
const jwt = require('jsonwebtoken');

class UserAuthService {
  constructor() {
    this.JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-key-change-in-production';
    this.JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';
  }

  // Generar token para usuario
  generateToken(userId, username, role) {
    const payload = {
      userId,
      username,
      role,
      type: 'user_access_token',
      iat: Math.floor(Date.now() / 1000),
    };

    return jwt.sign(payload, this.JWT_SECRET, { 
      expiresIn: this.JWT_EXPIRES_IN,
      issuer: 'booksy-api',
      audience: 'booksy-users'
    });
  }

  // Verificar token
  verifyToken(token) {
    try {
      const decoded = jwt.verify(token, this.JWT_SECRET, {
        issuer: 'booksy-api',
        audience: 'booksy-users'
      });
      
      if (decoded.type !== 'user_access_token') {
        throw new Error('Invalid token type');
      }

      return {
        valid: true,
        userId: decoded.userId,
        username: decoded.username,
        role: decoded.role
      };
    } catch (error) {
      return {
        valid: false,
        error: error.message
      };
    }
  }
}

module.exports = new UserAuthService();