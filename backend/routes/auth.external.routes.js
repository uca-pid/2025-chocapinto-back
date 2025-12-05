const express = require('express');
const router = express.Router();
const authExternalController = require('../controllers/auth.external.controller');

// OAuth 2.0 Token Endpoint (RFC 6749)
router.post('/token', authExternalController.getAccessToken);

// Token Refresh Endpoint
router.post('/refresh', authExternalController.refreshToken);

// Token Introspection Endpoint (RFC 7662)
router.post('/introspect', authExternalController.introspectToken);

// Authorization Server Metadata (RFC 8414)
router.get('/.well-known/oauth-authorization-server', authExternalController.getAuthorizationServerMetadata);

module.exports = router;