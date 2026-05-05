const express = require('express');
const router  = express.Router();
const auth    = require('../middleware/auth');
const prisma  = require('../lib/prisma');

router.get('/', auth, async (req, res) => {
  try {
    const materials = await prisma.material.findMany({ orderBy: { name: 'asc' } });
    res.json(materials);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', auth, async (req, res) => {
  try {
    const { name, category, totalStock, notes } = req.body;
    if (!name) return res.status(400).json({ error: 'name is required' });
    const material = await prisma.material.create({
      data: { name, category, totalStock: parseInt(totalStock) || 1, notes }
    });
    res.json(material);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', auth, async (req, res) => {
  try {
    const { name, category, totalStock, notes } = req.body;
    if (!name) return res.status(400).json({ error: 'name is required' });
    const material = await prisma.material.update({
      where: { id: parseInt(req.params.id) },
      data:  { name, category, totalStock: parseInt(totalStock), notes }
    });
    res.json(material);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', auth, async (req, res) => {
  try {
    await prisma.material.delete({ where: { id: parseInt(req.params.id) } });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
