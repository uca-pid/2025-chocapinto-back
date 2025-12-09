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
const periodoRoutes = require('./routes/periodo.routes');
const sesionRoutes = require('./routes/sesion.routes');
const notificacionesRoutes = require('./routes/notificaciones.routes');
const scheduledRoutes = require('./routes/scheduled.routes');

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());

// Usar rutas con prefijo API (nuevo)
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/clubs', clubRoutes);
app.use('/api/books', bookRoutes);
app.use('/api/comments', commentRoutes);
app.use('/api/categorias', categoriaRoutes);
app.use('/api/history', historyRoutes);
app.use('/api', periodoRoutes);
app.use('/api/sesiones', sesionRoutes);
app.use('/api/notificaciones', notificacionesRoutes);
app.use('/api/scheduled', scheduledRoutes);


// Mantener rutas legacy para compatibilidad
app.use('/', userRoutes);
app.use('/', clubRoutes);
app.use('/', bookRoutes);
app.use('/', commentRoutes);
app.use('/', categoriaRoutes);
app.use('/', authRoutes);
app.use('/', historyRoutes);
app.use('/', periodoRoutes);
app.use('/sesiones', sesionRoutes);

// Ruta de salud
app.get('/health', (req, res) => {
  res.json({ 
    success: true, 
    message: 'API funcionando correctamente',
    timestamp: new Date().toISOString()
  });
});

module.exports = app;
