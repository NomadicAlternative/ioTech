'use strict';

const { Router } = require('express');
const clientsService = require('./clients.service');
const authGuard = require('../../shared/middleware/authGuard');
const tenantResolver = require('../../shared/middleware/tenantResolver');

const router = Router();

router.use(authGuard, tenantResolver);

/** GET /api/clients */
router.get('/', async (req, res, next) => {
  try {
    const clients = await clientsService.list(req.tenantId);
    res.json({ data: clients });
  } catch (err) {
    next(err);
  }
});

/** GET /api/clients/:id */
router.get('/:id', async (req, res, next) => {
  try {
    const client = await clientsService.getById(req.tenantId, req.params.id);
    res.json({ data: client });
  } catch (err) {
    next(err);
  }
});

/** POST /api/clients */
router.post('/', async (req, res, next) => {
  try {
    const client = await clientsService.create(req.tenantId, req.body);
    res.status(201).json({ data: client });
  } catch (err) {
    next(err);
  }
});

/** PUT /api/clients/:id */
router.put('/:id', async (req, res, next) => {
  try {
    const client = await clientsService.update(req.tenantId, req.params.id, req.body);
    res.json({ data: client });
  } catch (err) {
    next(err);
  }
});

/** DELETE /api/clients/:id */
router.delete('/:id', async (req, res, next) => {
  try {
    await clientsService.remove(req.tenantId, req.params.id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

module.exports = router;
