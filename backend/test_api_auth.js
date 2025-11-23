// Test de API Booksy con autenticación
// IMPORTANTE: Ejecutar con server_nuevo.js activo
// Usar: node test_api_auth.js

const http = require('http');

const API_BASE = 'http://localhost:5000/api/booksy';
const API_KEY = 'booksy-external-api-2024-secure-key';

function makeRequest(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const options = {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    };

    const req = http.request(url, options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve({ error: 'Invalid JSON', raw: data });
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.end();
  });
}

async function testAPI() {
  console.log('🧪 PROBANDO API BOOKSY CON AUTENTICACIÓN\n');

  // Test 1: Sin API Key (debería fallar)
  console.log('1. Probando sin API Key (debería fallar)...');
  try {
    const result = await makeRequest(`${API_BASE}/users`);
    console.log('❌ Error esperado:', result.message || result.error);
  } catch (error) {
    console.log('❌ Error de conexión:', error.message);
  }

  console.log('\n2. Probando con API Key válida...');
  // Test 2: Con API Key válida
  try {
    const result = await makeRequest(`${API_BASE}/users`, {
      'x-api-key': API_KEY
    });
    
    if (result.success) {
      console.log('✅ API funcionando correctamente');
      console.log(`📊 Total usuarios: ${result.data.totalUsers}`);
      console.log(`🔐 Request ID: ${result.apiInfo.requestId}`);
    } else {
      console.log('❌ Error en API:', result.message || result.error);
    }
  } catch (error) {
    console.log('❌ Error de conexión:', error.message);
  }

  console.log('\n3. Probando endpoint específico de usuario...');
  // Test 3: Usuario específico
  try {
    const result = await makeRequest(`${API_BASE}/users/1`, {
      'x-api-key': API_KEY
    });
    
    if (result.success) {
      console.log('✅ Usuario específico obtenido');
      console.log(`👤 Usuario: ${result.data.username}`);
      console.log(`📚 Cursos: ${result.data.totalCourses}`);
    } else {
      console.log('❌ Error:', result.message || result.error);
    }
  } catch (error) {
    console.log('❌ Error de conexión:', error.message);
  }
}

testAPI().catch(console.error);