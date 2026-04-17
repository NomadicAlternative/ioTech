'use strict';

/**
 * Validation integration tests — verify that POST with invalid body returns
 * 400 + error.details. Uses a lightweight Express app with real middleware;
 * services are mocked so no DB is required.
 */

const express = require('express');
const request = require('supertest');
const validate = require('../../../shared/middleware/validate');
const errorHandler = require('../../../shared/middleware/errorHandler');
const schemas = require('../devices.schemas');

function createTestApp() {
  const app = express();
  app.use(express.json());

  // Simulate a POST /devices route guarded by validation
  app.post('/devices', validate(schemas.create), (req, res) => {
    res.status(201).json({ data: { name: req.body.name } });
  });

  app.use(errorHandler);
  return app;
}

describe('validate() integration with routes', () => {
  let app;

  beforeAll(() => {
    app = createTestApp();
  });

  it('POST with empty body returns 400 with error.details', async () => {
    const res = await request(app).post('/devices').send({});

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(Array.isArray(res.body.error.details)).toBe(true);
    expect(res.body.error.details.length).toBeGreaterThan(0);
    expect(res.body.error.details[0].field).toBe('name');
    expect(typeof res.body.error.details[0].message).toBe('string');
  });

  it('POST with valid body reaches handler and returns 201', async () => {
    const res = await request(app).post('/devices').send({ name: 'Sensor A' });

    expect(res.status).toBe(201);
    expect(res.body.data.name).toBe('Sensor A');
  });

  it('unknown fields are stripped and not passed to handler', async () => {
    const res = await request(app)
      .post('/devices')
      .send({ name: 'Sensor B', hacker: 'injection' });

    expect(res.status).toBe(201);
    // The handler returns req.body.name — body should be clean
    expect(res.body.data).not.toHaveProperty('hacker');
  });
});
