/**
 * Middleware para autenticar API Keys externas
 * Valida API Keys en headers (X-API-Key o Authorization)
 * Permite acceso desde orígenes configurados
 */
const authenticateExternalAPI = (req, res, next) => {
  try {
    const apiKey = req.headers['x-api-key'] || req.headers['authorization'];
    
    if (!apiKey) {
      return res.status(401).json({
        success: false,
        message: "API Key requerida",
        error: "UNAUTHORIZED"
      });
    }

    const VALID_API_KEYS = [
      process.env.BOOKSY_API_KEY || "booksy-external-api-2025",
      process.env.EXTERNAL_API_KEY || "external-system-key-123"
    ];

    const isValidKey = VALID_API_KEYS.includes(apiKey.replace('Bearer ', ''));
    
    if (!isValidKey) {
      return res.status(401).json({
        success: false,
        message: "API Key inválida",
        error: "INVALID_API_KEY"
      });
    }

    req.externalAPI = {
      authenticated: true,
      source: 'external_system',
      timestamp: new Date()
    };

    next();

  } catch (error) {
    console.error('[ERROR] Error en autenticación de API externa:', error);
    res.status(500).json({
      success: false,
      message: "Error interno en autenticación",
      error: "AUTH_ERROR"
    });
  }
};

module.exports = { authenticateExternalAPI };