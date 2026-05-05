const express = require('express');
const router  = express.Router();
const auth    = require('../middleware/auth');
const prisma  = require('../lib/prisma');

// Attach person to project
router.post('/person', auth, async (req, res) => {
  try {
    const { projectId, personId, role, startDate, endDate } = req.body;
    if (!projectId || !personId || !startDate || !endDate)
      return res.status(400).json({ error: 'projectId, personId, startDate and endDate are required' });

    const conflict = await prisma.projectPerson.findFirst({
      where: {
        personId: parseInt(personId),
        NOT: { projectId: parseInt(projectId) },
        project: {
          AND: [
            { startDate: { lte: new Date(endDate) } },
            { endDate:   { gte: new Date(startDate) } }
          ]
        }
      },
      include: { project: true }
    });

    if (conflict) {
      return res.status(409).json({
        error: `This person is already scheduled on project "${conflict.project.name}" during this period`
      });
    }

    const booking = await prisma.projectPerson.create({
      data: {
        projectId: parseInt(projectId),
        personId:  parseInt(personId),
        role,
        startDate: new Date(startDate),
        endDate:   new Date(endDate)
      },
      include: { person: true }
    });
    res.json(booking);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Remove person from project
router.delete('/person/:id', auth, async (req, res) => {
  try {
    await prisma.projectPerson.delete({ where: { id: parseInt(req.params.id) } });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Attach material to project
router.post('/material', auth, async (req, res) => {
  try {
    const { projectId, materialId, quantity, startDate, endDate } = req.body;
    if (!projectId || !materialId || !quantity || !startDate || !endDate)
      return res.status(400).json({ error: 'projectId, materialId, quantity, startDate and endDate are required' });

    const existing = await prisma.projectMaterial.aggregate({
      where: {
        materialId: parseInt(materialId),
        NOT: { projectId: parseInt(projectId) },
        project: {
          AND: [
            { startDate: { lte: new Date(endDate) } },
            { endDate:   { gte: new Date(startDate) } }
          ]
        }
      },
      _sum: { quantity: true }
    });

    const material      = await prisma.material.findUnique({ where: { id: parseInt(materialId) } });
    const alreadyBooked = existing._sum.quantity || 0;

    if (alreadyBooked + parseInt(quantity) > material.totalStock) {
      return res.status(409).json({
        error: `Not enough stock. Total: ${material.totalStock}, already booked: ${alreadyBooked}, available: ${material.totalStock - alreadyBooked}`
      });
    }

    const booking = await prisma.projectMaterial.create({
      data: {
        projectId:  parseInt(projectId),
        materialId: parseInt(materialId),
        quantity:   parseInt(quantity),
        startDate:  new Date(startDate),
        endDate:    new Date(endDate)
      },
      include: { material: true }
    });
    res.json(booking);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Remove material from project
router.delete('/material/:id', auth, async (req, res) => {
  try {
    await prisma.projectMaterial.delete({ where: { id: parseInt(req.params.id) } });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
