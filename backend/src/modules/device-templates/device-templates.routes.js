'use strict';

const { Router } = require('express');
const templatesService = require('./device-templates.service');
const authGuard = require('../../shared/middleware/authGuard');
const tenantResolver = require('../../shared/middleware/tenantResolver');

const router = Router();

router.use(authGuard, tenantResolver);

/** GET /api/device-templates */
router.get('/', async (req, res, next) => {
  try {
    const templates = await templatesService.list(req.tenantId);
    res.json({ data: templates });
  } catch (err) {
    next(err);
  }
});

/** GET /api/device-templates/:id */
router.get('/:id', async (req, res, next) => {
  try {
    const template = await templatesService.getById(req.tenantId, req.params.id);
    res.json({ data: template });
  } catch (err) {
    next(err);
  }
});

/** POST /api/device-templates */
router.post('/', async (req, res, next) => {
  try {
    const template = await templatesService.create(req.tenantId, req.body);
    res.status(201).json({ data: template });
  } catch (err) {
    next(err);
  }
});

/** PUT /api/device-templates/:id */
router.put('/:id', async (req, res, next) => {
  try {
    const template = await templatesService.update(req.tenantId, req.params.id, req.body);
    res.json({ data: template });
  } catch (err) {
    next(err);
  }
});

/** DELETE /api/device-templates/:id */
router.delete('/:id', async (req, res, next) => {
  try {
    await templatesService.remove(req.tenantId, req.params.id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

module.exports = router;
