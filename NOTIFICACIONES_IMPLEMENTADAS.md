# Sistema de Notificaciones - Alta Prioridad

## 🎯 Notificaciones Implementadas

### 1. **Solicitud Aceptada/Rechazada** ✅
- **Cuándo**: Cuando un moderador/owner acepta o rechaza una solicitud para unirse al club
- **Destinatario**: El usuario que envió la solicitud
- **Tipos**:
  - `SOLICITUD_ACEPTADA`: ✅ Solicitud aceptada
  - `SOLICITUD_RECHAZADA`: ❌ Solicitud rechazada
- **Archivo**: `club.controller.js` (función `manageMembershipRequest`)

### 2. **Votación Por Vencer** ⏰
- **Cuándo**: 24 horas antes de que cierre una votación
- **Destinatarios**: Todos los miembros del club
- **Tipo**: `VOTACION_POR_VENCER`
- **Verificación**: Automática cada 1 hora
- **Archivo**: `periodo.controller.js` (función `notificarVotacionesPorVencer`)

### 3. **Sesión Próxima** 📅
- **Cuándo**: 24 horas antes de una sesión programada
- **Destinatarios**: Todos los miembros del club
- **Tipo**: `SESION_PROXIMA`
- **Verificación**: Automática cada 1 hora
- **Archivo**: `sesion.controller.js` (función `notificarSesionesCercanas`)

## 🔧 Archivos Modificados

### Backend
1. **club.controller.js**
   - Agregado import de `crearNotificacion`
   - Modificada función `manageMembershipRequest` para enviar notificaciones

2. **periodo.controller.js**
   - Agregada función `notificarVotacionesPorVencer()`
   - Exportada en `module.exports`

3. **sesion.controller.js**
   - Agregada función `notificarSesionesCercanas()`
   - Exportada en `module.exports`

4. **utils/scheduledTasks.js** (NUEVO)
   - Función `ejecutarVerificacionesPeriodicas()`
   - Función `iniciarVerificacionesAutomaticas()`
   - Ejecuta verificaciones cada 1 hora

5. **routes/scheduled.routes.js** (NUEVO)
   - Endpoint `POST /api/scheduled/verificar` para testing manual

6. **server.js / server_nuevo.js / app.js**
   - Importado `iniciarVerificacionesAutomaticas`
   - Iniciado sistema automático al arrancar servidor
   - Registradas rutas de scheduled

### Frontend
1. **notificaciones-alertas.js**
   - Agregados iconos para los nuevos tipos:
     - `SESION_PROXIMA`: Reloj (urgente)
     - `VOTACION_POR_VENCER`: Reloj con alertas (urgente)
     - `VOTACION_CERRADA`: Check (success)
     - `SOLICITUD_ACEPTADA`: Check en círculo (success)
     - `SOLICITUD_RECHAZADA`: X en círculo (error)
     - `LECTURA_FINALIZADA`: Libro con check (success)

2. **notificacion-alerta.css**
   - Agregados estilos para nuevas clases:
     - `.notif-urgente`: Fondo rojo claro, icono rojo oscuro
     - `.notif-success`: Fondo verde claro, icono verde oscuro
     - `.notif-error`: Fondo rojo claro, icono rojo intenso

## 🚀 Cómo Usar

### Iniciar el Servidor
```bash
cd backend
node server_nuevo.js
```

Al iniciar verás:
```
🚀 Servidor corriendo en puerto 5000
📚 API disponible en http://localhost:5000
⏰ Iniciando sistema de notificaciones automáticas...
🚀 Iniciando verificaciones automáticas (cada 1 hora)...
🕐 Ejecutando verificaciones periódicas...
✅ Votaciones verificadas: 0 notificaciones enviadas
✅ Sesiones verificadas: 0 notificaciones enviadas
```

### Testing Manual
Puedes ejecutar las verificaciones manualmente con:
```bash
curl -X POST http://localhost:5000/api/scheduled/verificar
```

Respuesta:
```json
{
  "success": true,
  "message": "Verificaciones ejecutadas correctamente",
  "resultado": {
    "success": true,
    "votaciones": 2,
    "sesiones": 1
  }
}
```

## 🧪 Cómo Probar

### 1. Solicitud Aceptada/Rechazada
1. Un usuario envía solicitud para unirse a un club
2. Moderador/Owner acepta o rechaza desde el modal de solicitudes
3. El usuario solicitante recibe la notificación inmediatamente
4. Aparece en el badge de notificaciones

### 2. Votación Por Vencer
1. Crear una votación que cierre en menos de 24 horas
2. Esperar a que se ejecute la verificación automática (cada 1 hora)
   - O ejecutar manualmente: `POST /api/scheduled/verificar`
3. Todos los miembros del club recibirán la notificación
4. Incluye información de cuántas horas quedan y libros disponibles

### 3. Sesión Próxima
1. Crear una sesión para dentro de 23 horas
2. Esperar a que se ejecute la verificación automática (cada 1 hora)
   - O ejecutar manualmente: `POST /api/scheduled/verificar`
3. Todos los miembros del club recibirán el recordatorio
4. Incluye título, fecha, hora y lugar de la sesión

## 📊 Logs del Sistema

Los logs mostrarán:
```
🕐 Ejecutando verificaciones periódicas...
🔍 Verificando votaciones por vencer: 2 encontradas
📢 Notificación enviada: Votación "Enero 2025" por vencer en 18h
📢 Notificación enviada: Votación "Verano" por vencer en 22h
✅ Votaciones verificadas: 2 notificaciones enviadas

🔍 Verificando sesiones cercanas: 1 encontradas
📢 Notificación enviada: Sesión "Discusión 1984" en 19h
✅ Sesiones verificadas: 1 notificaciones enviadas
```

## ⚙️ Configuración

### Cambiar Frecuencia de Verificación
En `utils/scheduledTasks.js`:
```javascript
// Cada 1 hora (3600000 ms)
setInterval(ejecutarVerificacionesPeriodicas, 3600000);

// Cambiar a 30 minutos:
setInterval(ejecutarVerificacionesPeriodicas, 1800000);

// Cambiar a 15 minutos:
setInterval(ejecutarVerificacionesPeriodicas, 900000);
```

### Cambiar Ventana de Notificación
En `periodo.controller.js` y `sesion.controller.js`:
```javascript
// Notificar 24 horas antes
const en24Horas = new Date(ahora.getTime() + 24 * 60 * 60 * 1000);

// Cambiar a 48 horas antes:
const en48Horas = new Date(ahora.getTime() + 48 * 60 * 60 * 1000);

// Cambiar a 12 horas antes:
const en12Horas = new Date(ahora.getTime() + 12 * 60 * 60 * 1000);
```

## 🎨 Personalización de Estilos

Los colores se pueden cambiar en `notificacion-alerta.css`:

```css
/* Notificaciones urgentes (rojo) */
.notif-urgente .notif-icono {
  background: #ffebee;
  color: #d32f2f;
}

/* Notificaciones de éxito (verde) */
.notif-success .notif-icono {
  background: #e8f5e9;
  color: #2e7d32;
}

/* Notificaciones de error (rojo intenso) */
.notif-error .notif-icono {
  background: #ffebee;
  color: #c62828;
}
```

## 🔄 Próximas Mejoras (Futuro)

- **Notificaciones por email** para eventos importantes
- **Configuración de preferencias** (usuarios pueden elegir qué notificaciones recibir)
- **Notificaciones push** (web push notifications)
- **Historial de notificaciones** con paginación
- **Prioridad de notificaciones** (alta/media/baja)
- **Agrupación de notificaciones** similares

## 🐛 Troubleshooting

### Las verificaciones no se ejecutan
- Verificar que el servidor se inició correctamente
- Buscar en logs: `⏰ Iniciando sistema de notificaciones automáticas...`
- Ejecutar manualmente: `POST /api/scheduled/verificar`

### No recibo notificaciones
- Verificar que hay votaciones/sesiones dentro de las 24 horas
- Verificar logs del servidor para errores
- Verificar que el usuario es miembro del club
- Revisar el badge de notificaciones en el frontend

### Badge no se actualiza
- El polling es cada 30 segundos
- Verificar que `initNotificaciones(userId)` se está llamando
- Abrir consola del navegador y buscar errores
