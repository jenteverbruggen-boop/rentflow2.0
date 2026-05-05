const express = require('express');
const router  = express.Router();
const auth    = require('../middleware/auth');
const { PrismaClient } = require('@prisma/client');
const prisma  = new PrismaClient();

router.get('/', auth, async (req, res) => {
  const materials = await prisma.material.findMany({ orderBy: { name: 'asc' } });
  res.json(materials);
});

router.post('/', auth, async (req, res) => {
  const { name, category, totalStock, notes } = req.body;
  const material = await prisma.material.create({
    data: { name, category, totalStock: parseInt(totalStock), notes }
  });
  res.json(material);
});

router.put('/:id', auth, async (req, res) => {
  const { name, category, totalStock, notes } = req.body;
  const material = await prisma.material.update({
    where: { id: parseInt(req.params.id) },
    data:  { name, category, totalStock: parseInt(totalStock), notes }
  });
  res.json(material);
});

router.delete('/:id', auth, async (req, res) => {
  await prisma.material.delete({ where: { id: parseInt(req.params.id) } });
  res.json({ success: true });
});

module.exports = router;
