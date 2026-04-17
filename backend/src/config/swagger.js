'use strict';

/**
 * Swagger / OpenAPI configuration.
 * Used by swagger-jsdoc to generate the OpenAPI spec from JSDoc annotations.
 */

const path = require('path');

const swaggerDefinition = {
  openapi: '3.0.0',
  info: {
    title: 'ioTech API',
    version: '1.0.0',
    description: 'IoT SaaS platform API',
  },
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
    },
    schemas: {
      Error: {
        type: 'object',
        properties: {
          error: {
            type: 'object',
            properties: {
              code: { type: 'string', example: 'NOT_FOUND' },
              message: { type: 'string' },
              status: { type: 'integer', example: 404 },
            },
          },
        },
      },
      ValidationError: {
        type: 'object',
        properties: {
          error: {
            type: 'object',
            properties: {
              code: { type: 'string', example: 'VALIDATION_ERROR' },
              message: { type: 'string' },
              status: { type: 'integer', example: 400 },
              details: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    field: { type: 'string' },
                    message: { type: 'string' },
                  },
                },
              },
            },
          },
        },
      },
      Meta: {
        type: 'object',
        properties: {
          page: { type: 'integer', example: 1 },
          limit: { type: 'integer', example: 20 },
          total: { type: 'integer', example: 150 },
          totalPages: { type: 'integer', example: 8 },
        },
      },
    },
  },
};

module.exports = {
  swaggerDefinition,
  apis: [path.join(__dirname, '../modules/**/*.routes.js')],
};
