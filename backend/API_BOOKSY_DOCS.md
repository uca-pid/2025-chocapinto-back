# API Booksy - Documentación para Sistemas Externos

## 🔐 Autenticación
Todas las requests a la API Booksy requieren una API Key válida en los headers:

### Método 1: Header x-api-key
```
Headers:
x-api-key: YOUR_API_KEY
Content-Type: application/json
```

### Método 2: Authorization Bearer
```
Headers:
Authorization: Bearer YOUR_API_KEY
Content-Type: application/json
```

## 🎯 Endpoints Disponibles

### 1. Obtener todos los usuarios con cursos
**GET** `/api/booksy/users`

**Descripción:** Lista todos los usuarios que tienen cursos activos de señasApp con sus respectivos progresos.

**Respuesta:**
```json
{
  "success": true,
  "message": "Datos de usuarios con cursos obtenidos exitosamente",
  "data": {
    "totalUsers": 3,
    "users": [
      {
        "userId": 1,
        "username": "River912",
        "email": "river@gmail.com",
        "level": 1,
        "xp": 300,
        "totalCourses": 3,
        "activeCourses": 1,
        "completedCourses": 1,
        "courses": [
          {
            "courseId": 102,
            "courseTitle": "Inversiones en Bolsa para Principiantes",
            "courseAuthor": "señasApp",
            "clubId": 2,
            "clubName": "River Fulbo",
            "status": "por_leer",
            "progressPercentage": 0,
            "startDate": "2025-11-23T18:12:36.161Z",
            "endDate": null,
            "lastUpdate": "2025-11-23T18:12:36.161Z"
          }
        ]
      }
    ]
  },
  "apiInfo": {
    "version": "1.0",
    "timestamp": "2025-11-23T19:30:00.000Z",
    "source": "external_system",
    "requestId": "req_1700765400000_abc123def"
  }
}
```

### 2. Obtener cursos de usuario específico
**GET** `/api/booksy/users/{userId}`

**Parámetros:**
- `userId` (number): ID del usuario

**Descripción:** Obtiene información detallada de los cursos de un usuario específico.

**Respuesta:** Similar al endpoint anterior pero solo para un usuario.

### 3. Estadísticas de clubes
**GET** `/api/booksy/clubs/stats`

**Descripción:** Obtiene estadísticas generales de cursos por club.

**Respuesta:**
```json
{
  "success": true,
  "message": "Estadísticas de cursos por club obtenidas exitosamente",
  "data": {
    "totalClubs": 1,
    "clubs": [
      {
        "clubId": 2,
        "clubName": "River Fulbo",
        "totalMembers": 3,
        "totalCourses": 3,
        "activeCourses": 1,
        "completedCourses": 1,
        "averageProgress": 33
      }
    ]
  },
  "apiInfo": {
    "version": "1.0",
    "timestamp": "2025-11-23T19:30:00.000Z",
    "source": "external_system",
    "requestId": "req_1700765400000_xyz789abc"
  }
}
```

## 📊 Estados de Cursos

- `por_leer`: Curso disponible pero no iniciado (0% progreso)
- `leyendo`: Curso en progreso (5-95% progreso)
- `leido`: Curso completado (100% progreso)

## ❌ Códigos de Error

| Código | Error | Descripción |
|--------|-------|-------------|
| `401` | UNAUTHORIZED | API Key faltante |
| `401` | INVALID_API_KEY | API Key inválida |
| `403` | FORBIDDEN_ORIGIN | Origen no permitido |
| `404` | NOT_FOUND | Usuario no encontrado |
| `500` | INTERNAL_SERVER_ERROR | Error interno del servidor |

## 🧪 Ejemplos de Uso

### Thunder Client / Postman
```
GET http://localhost:5000/api/booksy/users
Headers:
  x-api-key: booksy-external-api-2024-secure-key
  Content-Type: application/json
```

### cURL
```bash
curl -X GET "http://localhost:5000/api/booksy/users" \
  -H "x-api-key: booksy-external-api-2024-secure-key" \
  -H "Content-Type: application/json"
```

### JavaScript Fetch
```javascript
fetch('http://localhost:5000/api/booksy/users', {
  method: 'GET',
  headers: {
    'x-api-key': 'booksy-external-api-2024-secure-key',
    'Content-Type': 'application/json'
  }
})
.then(response => response.json())
.then(data => console.log(data));
```

## 🔒 Seguridad

- ✅ Autenticación mediante API Key obligatoria
- ✅ Validación de origen (CORS configurado)
- ✅ Solo métodos GET permitidos
- ✅ Rate limiting recomendado (implementar si es necesario)
- ✅ Logs de todas las requests para auditoría

## 🎯 Notas Importantes

1. Solo se devuelven cursos con `author: "señasApp"` y `id_api` no null
2. Los porcentajes de progreso se calculan automáticamente
3. La información de debug solo se incluye en desarrollo
4. Todas las respuestas incluyen metadatos de API para tracking