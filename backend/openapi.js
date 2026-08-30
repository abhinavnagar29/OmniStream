const bearerAuth = { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' };

module.exports = {
  openapi: '3.0.3',
  info: {
    title: 'OmniStream API',
    version: '2.0.0',
    description:
      'Cross-domain recommendation platform. Most endpoints require a Bearer JWT obtained from POST /api/auth/login.',
  },
  servers: [{ url: '/api' }],
  components: {
    securitySchemes: { bearerAuth },
    schemas: {
      ContentItem: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          domain: { type: 'string', enum: ['video', 'music', 'podcast', 'movie', 'news'] },
          title: { type: 'string' },
          description: { type: 'string' },
          rating: { type: 'number' },
          popularity: { type: 'number' },
          topic: { type: 'string' },
          relevanceScore: { type: 'number' },
          explanation: { type: 'object' },
        },
      },
      Error: {
        type: 'object',
        properties: { error: { type: 'object', properties: { message: { type: 'string' } } } },
      },
    },
  },
  paths: {
    '/auth/signup': {
      post: {
        summary: 'Create an account',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', properties: { email: { type: 'string' }, password: { type: 'string' }, displayName: { type: 'string' } }, required: ['email', 'password'] } } },
        },
        responses: { 201: { description: 'Created' }, 409: { description: 'Email already registered' } },
      },
    },
    '/auth/login': {
      post: {
        summary: 'Log in, returns a JWT',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', properties: { email: { type: 'string' }, password: { type: 'string' } }, required: ['email', 'password'] } } },
        },
        responses: { 200: { description: 'OK, returns {user, token}' }, 401: { description: 'Invalid credentials' } },
      },
    },
    '/auth/me': {
      get: { summary: 'Current user', security: [{ bearerAuth: [] }], responses: { 200: { description: 'OK' }, 401: { description: 'Unauthorized' } } },
    },
    '/recommendations': {
      get: {
        summary: 'Two-stage personalized recommendations (semantic ANN + CF retrieval, then ranking + MMR diversity)',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'domain', in: 'query', schema: { type: 'string' } },
          { name: 'limit', in: 'query', schema: { type: 'integer' } },
          { name: 'mode', in: 'query', schema: { type: 'string', enum: ['home', 'for-you', 'trending'] } },
          { name: 'explore', in: 'query', schema: { type: 'number' }, description: 'MMR diversity pressure, 0..1' },
        ],
        responses: { 200: { description: 'OK', content: { 'application/json': { schema: { type: 'object', properties: { data: { type: 'array', items: { $ref: '#/components/schemas/ContentItem' } } } } } } } },
      },
    },
    '/search': {
      get: {
        summary: 'Full-text content search',
        parameters: [{ name: 'q', in: 'query', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'OK' } },
      },
    },
    '/feedback/like': { post: { summary: 'Like an item', security: [{ bearerAuth: [] }], responses: { 201: { description: 'OK' } } } },
    '/feedback/unlike': { post: { summary: 'Unlike an item', security: [{ bearerAuth: [] }], responses: { 201: { description: 'OK' } } } },
    '/feedback/open': { post: { summary: 'Record an open event', security: [{ bearerAuth: [] }], responses: { 201: { description: 'OK' } } } },
    '/feedback/skip': { post: { summary: 'Record a skip event', security: [{ bearerAuth: [] }], responses: { 201: { description: 'OK' } } } },
    '/profile': { get: { summary: 'Current implicit-feedback user profile', security: [{ bearerAuth: [] }], responses: { 200: { description: 'OK' } } } },
    '/preferences': { get: { summary: 'Onboarding/explicit preferences', security: [{ bearerAuth: [] }], responses: { 200: { description: 'OK' } } } },
    '/onboarding': { post: { summary: 'Complete onboarding', security: [{ bearerAuth: [] }], responses: { 201: { description: 'OK' } } } },
    '/library': { get: { summary: 'Liked items', security: [{ bearerAuth: [] }], responses: { 200: { description: 'OK' } } } },
    '/journeys': { get: { summary: 'Cross-domain content journeys', security: [{ bearerAuth: [] }], responses: { 200: { description: 'OK' } } } },
    '/metrics': { get: { summary: 'Personalization/diversity metrics dashboard data', security: [{ bearerAuth: [] }], responses: { 200: { description: 'OK' } } } },
    '/personas': { get: { summary: 'List available personas', responses: { 200: { description: 'OK' } } } },
    '/experiments/{experiment}/variant': {
      get: { summary: 'Get/assign this user\'s A/B variant', security: [{ bearerAuth: [] }], parameters: [{ name: 'experiment', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'OK' } } },
    },
    '/health': { get: { summary: 'Liveness + dependency health (Postgres, Redis, CF model, ranker)', responses: { 200: { description: 'OK' }, 503: { description: 'A dependency is unreachable' } } } },
  },
};
