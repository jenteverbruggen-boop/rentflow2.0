const express = require('express');
const router  = express.Router();
const auth    = require('../middleware/auth');
const prisma  = require('../lib/prisma');

router.get('/', auth, async (req, res) => {
  try {
    const people = await prisma.person.findMany({ orderBy: { name: 'asc' } });
    res.json(people);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', auth, async (req, res) => {
  try {
    const { name, role, email, phone } = req.body;
    if (!name) return res.status(400).json({ error: 'name is required' });
    const person = await prisma.person.create({ data: { name, role, email, phone } });
    res.json(person);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', auth, async (req, res) => {
  try {
    const { name, role, email, phone } = req.body;
    if (!name) return res.status(400).json({ error: 'name is required' });
    const person = await prisma.person.update({
      where: { id: parseInt(req.params.id) },
      data:  { name, role, email, phone }
    });
    res.json(person);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', auth, async (req, res) => {
  try {
    await prisma.person.delete({ where: { id: parseInt(req.params.id) } });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
