const express = require('express');
const router  = express.Router();
const auth    = require('../middleware/auth');
const prisma  = require('../lib/prisma');

router.get('/', auth, async (req, res) => {
  try {
    const projects = await prisma.project.findMany({
      orderBy: { startDate: 'asc' },
      include: {
        people:    { include: { person: true } },
        materials: { include: { material: true } }
      }
    });
    res.json(projects);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', auth, async (req, res) => {
  try {
    const project = await prisma.project.findUnique({
      where: { id: parseInt(req.params.id) },
      include: {
        people:    { include: { person: true } },
        materials: { include: { material: true } }
      }
    });
    if (!project) return res.status(404).json({ error: 'Not found' });
    res.json(project);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', auth, async (req, res) => {
  try {
    const { name, client, location, startDate, endDate, status, notes } = req.body;
    if (!name || !startDate || !endDate)
      return res.status(400).json({ error: 'name, startDate and endDate are required' });
    const project = await prisma.project.create({
      data: {
        name, client, location, status, notes,
        startDate: new Date(startDate),
        endDate:   new Date(endDate)
      }
    });
    res.json(project);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', auth, async (req, res) => {
  try {
    const { name, client, location, startDate, endDate, status, notes } = req.body;
    if (!name || !startDate || !endDate)
      return res.status(400).json({ error: 'name, startDate and endDate are required' });
    const project = await prisma.project.update({
      where: { id: parseInt(req.params.id) },
      data: {
        name, client, location, status, notes,
        startDate: new Date(startDate),
        endDate:   new Date(endDate)
      }
    });
    res.json(project);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', auth, async (req, res) => {
  try {
    await prisma.project.delete({ where: { id: parseInt(req.params.id) } });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
