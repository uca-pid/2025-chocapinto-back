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

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());

// Usar rutas
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/clubs', clubRoutes);
app.use('/api/books', bookRoutes);
app.use('/api/comments', commentRoutes);
app.use('/api/categorias', categoriaRoutes);
app.use('/api/history', historyRoutes);
app.use('/api/ranking', rankingRoutes);

// Rutas legacy (mantener compatibilidad)
app.use('/', userRoutes);
app.use('/', clubRoutes);
app.use('/', bookRoutes);
app.use('/', commentRoutes);
app.use('/', categoriaRoutes);
app.use('/', authRoutes);
app.use('/', historyRoutes);
app.use('/', rankingRoutes);

// Mensaje en la raíz para indicar que la API está disponible
app.get('/', (req, res) => {
  if (req.accepts('html')) {
    return res.send(`<!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Chocapinto API</title>
        </head>
        <body style="font-family: system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial;">
          <h1>📚 API disponible</h1>
          <p>La API está corriendo. Usa <code>/api/</code> para acceder a las rutas.</p>
          <p>Puerto: ${process.env.PORT || 5000}</p>
        </body>
      </html>`);
  }
  res.json({ success: true, message: 'API disponible', base: '/api' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
  console.log(`📚 API disponible en http://localhost:${PORT}`);
});

module.exports = app;