'use strict';

const { Router } = require('express');
const firmwareService = require('./firmware.service');
const authGuard = require('../../shared/middleware/authGuard');
const tenantResolver = require('../../shared/middleware/tenantResolver');
const validate = require('../../shared/middleware/validate');
const schemas = require('./firmware.schemas');

const router = Router();

router.use(authGuard, tenantResolver);

router.get('/', async (req, res, next) => {
  try {
    const data = await firmwareService.list(req.tenantId);
    res.json({ data });
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const fw = await firmwareService.getById(req.tenantId, req.params.id);
    res.json({ data: fw });
  } catch (err) {
    next(err);
  }
});

router.post('/', validate(schemas.create), async (req, res, next) => {
  try {
    const fw = await firmwareService.create(req.tenantId, req.body);
    res.status(201).json({ data: fw });
  } catch (err) {
    next(err);
  }
});

router.patch('/:id', validate(schemas.update), async (req, res, next) => {
  try {
    const fw = await firmwareService.update(req.tenantId, req.params.id, req.body);
    res.json({ data: fw });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    await firmwareService.remove(req.tenantId, req.params.id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

module.exports = router;
