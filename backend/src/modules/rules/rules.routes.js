'use strict';

const { Router } = require('express');
const rulesService = require('./rules.service');
const authGuard = require('../../shared/middleware/authGuard');
const tenantResolver = require('../../shared/middleware/tenantResolver');

const validate = require('../../shared/middleware/validate');
const schemas = require('./rules.schemas');

const router = Router();

// All rules routes require authentication + tenant scoping
router.use(authGuard, tenantResolver);

/**
 * @swagger
 * /api/rules:
 *   get:
 *     summary: List all automation rules for the authenticated tenant
 *     tags: [Rules]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Array of rules
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Rule'
 */
router.get('/', async (req, res, next) => {
  try {
    const rules = await rulesService.list(req.tenantId);
    res.json({ data: rules });
  } catch (err) {
    next(err);
  }
});

/**
 * @swagger
 * /api/rules:
 *   post:
 *     summary: Create a new automation rule
 *     tags: [Rules]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RuleCreateInput'
 *     responses:
 *       201:
 *         description: Created rule
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   $ref: '#/components/schemas/Rule'
 *       400:
 *         description: Validation error
 */
router.post('/', validate(schemas.create), async (req, res, next) => {
  try {
    const rule = await rulesService.create(req.tenantId, req.body);
    res.status(201).json({ data: rule });
  } catch (err) {
    next(err);
  }
});

/**
 * @swagger
 * /api/rules/{id}:
 *   get:
 *     summary: Get a single automation rule by ID
 *     tags: [Rules]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Rule ID
 *     responses:
 *       200:
 *         description: Rule object
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   $ref: '#/components/schemas/Rule'
 *       404:
 *         description: Rule not found
 */
router.get('/:id', async (req, res, next) => {
  try {
    const rule = await rulesService.getById(req.tenantId, req.params.id);
    res.json({ data: rule });
  } catch (err) {
    next(err);
  }
});

/**
 * @swagger
 * /api/rules/{id}:
 *   put:
 *     summary: Update an existing automation rule
 *     tags: [Rules]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Rule ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RuleUpdateInput'
 *     responses:
 *       200:
 *         description: Updated rule
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   $ref: '#/components/schemas/Rule'
 *       404:
 *         description: Rule not found
 */
router.put('/:id', validate(schemas.update), async (req, res, next) => {
  try {
    const rule = await rulesService.update(req.tenantId, req.params.id, req.body);
    res.json({ data: rule });
  } catch (err) {
    next(err);
  }
});

/**
 * @swagger
 * /api/rules/{id}:
 *   delete:
 *     summary: Delete an automation rule
 *     tags: [Rules]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Rule ID
 *     responses:
 *       204:
 *         description: Rule deleted (no content)
 *       404:
 *         description: Rule not found
 */
router.delete('/:id', async (req, res, next) => {
  try {
    await rulesService.remove(req.tenantId, req.params.id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

module.exports = router;
