const express = require('express');
const router  = express.Router();
const auth    = require('../middleware/auth');
const { PrismaClient } = require('@prisma/client');
const prisma  = new PrismaClient();

router.get('/', auth, async (req, res) => {
  const projects = await prisma.project.findMany({
    orderBy: { startDate: 'asc' },
    include: {
      people:    { include: { person: true } },
      materials: { include: { material: true } }
    }
  });
  res.json(projects);
});

router.get('/:id', auth, async (req, res) => {
  const project = await prisma.project.findUnique({
    where: { id: parseInt(req.params.id) },
    include: {
      people:    { include: { person: true } },
      materials: { include: { material: true } }
    }
  });
  if (!project) return res.status(404).json({ error: 'Niet gevonden' });
  res.json(project);
});

router.post('/', auth, async (req, res) => {
  const { name, client, location, startDate, endDate, status, notes } = req.body;
  const project = await prisma.project.create({
    data: {
      name, client, location, status, notes,
      startDate: new Date(startDate),
      endDate:   new Date(endDate)
    }
  });
  res.json(project);
});

router.put('/:id', auth, async (req, res) => {
  const { name, client, location, startDate, endDate, status, notes } = req.body;
  const project = await prisma.project.update({
    where: { id: parseInt(req.params.id) },
    data: {
      name, client, location, status, notes,
      startDate: new Date(startDate),
      endDate:   new Date(endDate)
    }
  });
  res.json(project);
});

router.delete('/:id', auth, async (req, res) => {
  await prisma.project.delete({ where: { id: parseInt(req.params.id) } });
  res.json({ success: true });
});

module.exports = router;
