// src/utils/validateFields.js
function validateRequiredFields(fields, body) {
  const missing = [];
  
  for (const field of fields) {
    // Verificar si el campo no existe, es null, undefined o string vacío después de trim
    if (body[field] === undefined || body[field] === null || 
        (typeof body[field] === 'string' && body[field].trim() === '')) {
      missing.push(field);
    }
  }
  
  return missing.length > 0 ? missing : null;
}

function validateEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

function validatePassword(password) {
  return password && password.length >= 6;
}

module.exports = {
  validateRequiredFields,
  validateEmail,
  validatePassword
};