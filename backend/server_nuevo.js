require("dotenv").config();
// src/server.js
const express = require("express");
const cors = require("cors");

// Importar rutas
const userRoutes = require('./routes/user.routes');
const clubRoutes = require('./routes/club.routes');
const bookRoutes = require('./routes/book.routes');
const commentRoutes = require('./routes/comment.routes');
const categoriaRoutes = require('./routes/categoria.routes');
const authRoutes = require('./routes/auth.routes');
const historyRoutes = require('./routes/history.routes');
const rankingRoutes = require('./routes/ranking.routes');
const periodoRoutes = require('./routes/periodo.routes');
const rankingGlobalRoutes = require('./routes/ranking.global.routes');
const apiBooksyRoutes = require('./routes/api_booksy.routes');
const authExternalRoutes = require('./routes/auth.external.routes');
const sesionRoutes = require('./routes/sesion.routes');
const notificacionesRoutes = require('./routes/notificaciones.routes');
const scheduledRoutes = require('./routes/scheduled.routes');

// Importar tareas programadas
const { iniciarVerificacionesAutomaticas } = require('./utils/scheduledTasks');

const app = express();

// Middlewares
app.use(express.json());

// CORS específico para API Booksy (sistemas externos)
app.use('/api/booksy', cors({
  origin: function (origin, callback) {
    // Permitir requests sin origen (como Postman, Thunder Client)
    if (!origin) return callback(null, true);
    
    const allowedOrigins = [
      'https://booksy-platform.com', //--> hay q poner la dire del render
      'https://api.external-system.com',
      'http://localhost:3000',
      'http://localhost:5173',
      'http://localhost:5500',     // Live Server
      'http://127.0.0.1:5500',     // Live Server alternativo
      'http://localhost:8080',     // Otros puertos comunes
      'http://127.0.0.1:8080'
    ];
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('No permitido por CORS para API externa'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key']
}));

// CORS general para el resto de rutas
app.use(cors());

app.use('/api/external/auth', authExternalRoutes);
// Usar rutas
app.use('/api/booksy', apiBooksyRoutes); // API externa protegida
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/clubs', clubRoutes);
app.use('/api/books', bookRoutes);
app.use('/api/comments', commentRoutes);
app.use('/api/categorias', categoriaRoutes);
app.use('/api/history', historyRoutes);
app.use('/api/ranking', rankingRoutes);
app.use('/api', periodoRoutes);
app.use('/api/global/ranking', rankingGlobalRoutes);
app.use('/api/sesiones', sesionRoutes);
app.use('/api/notificaciones', notificacionesRoutes);
app.use('/api/scheduled', scheduledRoutes);


// Rutas legacy (mantener compatibilidad)
app.use('/', userRoutes);
app.use('/', clubRoutes);
app.use('/', bookRoutes);
app.use('/', commentRoutes);
app.use('/', categoriaRoutes);
app.use('/', authRoutes);
app.use('/', historyRoutes);
app.use('/', rankingRoutes);
app.use('/', periodoRoutes);
app.use('/', rankingGlobalRoutes);
app.use('/sesion', sesionRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
  console.log(`📚 API disponible en http://localhost:${PORT}`);
  console.log(`🔐 OAuth 2.0 Token endpoint: http://localhost:${PORT}/api/external/auth/token`);
  
  // Iniciar verificaciones automáticas de notificaciones
  console.log('⏰ Iniciando sistema de notificaciones automáticas...');
  iniciarVerificacionesAutomaticas();
});

module.exports = app;