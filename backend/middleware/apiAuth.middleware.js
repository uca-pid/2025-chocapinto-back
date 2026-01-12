const authenticateExternalAPI = (req, res, next) => {
  try {
    // 1. Verificar API Key en headers
    const apiKey = req.headers['x-api-key'] || req.headers['authorization'];
    
    if (!apiKey) {
      return res.status(401).json({
        success: false,
        message: "API Key requerida",
        error: "UNAUTHORIZED"
      });
    }

    // 2. Validar la API Key (puedes usar variables de entorno)
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

    // 3. Verificar origen permitido (opcional)
    const allowedOrigins = [
  'https://booksy-platform.com', //--> hay q poner la dire del render
  'https://api.external-system.com', 
  'http://localhost:3000',
  'http://localhost:5173',
  'http://localhost:5500',  // Live Server
  'http://127.0.0.1:5500',  // Live Server alternativo
  'file://'                 // Archivos locales
];

    const origin = req.headers['origin'] || req.headers['referer'];
    
    // Solo verificar origen si existe (algunos clientes no lo envían)
    if (origin && !allowedOrigins.some(allowed => origin.includes(allowed))) {
      console.warn(`Acceso desde origen no permitido: ${origin}`);
      // Opcional: bloquear o solo advertir
      // return res.status(403).json({
      //   success: false,
      //   message: "Origen no permitido", 
      //   error: "FORBIDDEN_ORIGIN"
      // });
    }

    // 4. Agregar información de la API al request
    req.externalAPI = {
      authenticated: true,
      source: 'external_system',
      timestamp: new Date()
    };

    console.log(`📡 API Externa autenticada: ${apiKey.substring(0, 10)}... desde ${origin || 'No origin'}`);
    next();

  } catch (error) {
    console.error('Error en autenticación de API externa:', error);
    res.status(500).json({
      success: false,
      message: "Error interno en autenticación",
      error: "AUTH_ERROR"
    });
  }
};

module.exports = { authenticateExternalAPI };