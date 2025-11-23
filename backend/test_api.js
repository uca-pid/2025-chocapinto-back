// Test API Booksy
const express = require('express');
const apiBooksy = require('./controllers/api_booksy.controller');
const app = express();

app.use(express.json());

// Mock request and response objects
const mockRes = () => {
  const res = {};
  res.json = (data) => {
    console.log('=== RESPUESTA API ===');
    console.log(JSON.stringify(data, null, 2));
    return res;
  };
  res.status = (code) => {
    console.log(`Status: ${code}`);
    return res;
  };
  return res;
};

async function testAPI() {
  console.log('🧪 PROBANDO getUserCoursesById para usuario 1...\n');
  
  const req = {
    params: { userId: '1' }
  };
  
  await apiBooksy.getUserCoursesById(req, mockRes());
  
  console.log('\n🧪 PROBANDO getUsersWithCourses...\n');
  
  const req2 = {};
  await apiBooksy.getUsersWithCourses(req2, mockRes());
}

testAPI().catch(console.error);