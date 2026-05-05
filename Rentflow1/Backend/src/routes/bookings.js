const express = require('express');
const router  = express.Router();
const auth    = require('../middleware/auth');
const { PrismaClient } = require('@prisma/client');
const prisma  = new PrismaClient();

// Persoon aan project koppelen
router.post('/person', auth, async (req, res) => {
  const { projectId, personId, role, startDate, endDate } = req.body;

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
      error: `Deze persoon is al ingepland bij project "${conflict.project.name}" in deze periode`
    });
  }

  const booking = await prisma.projectPerson.create({
    data: {
      projectId: parseInt(projectId),
      personId:  parseInt(personId),
      role,
      startDate: startDate ? new Date(startDate) : null,
      endDate:   endDate   ? new Date(endDate)   : null
    },
    include: { person: true }
  });
  res.json(booking);
});

// Persoon van project verwijderen
router.delete('/person/:id', auth, async (req, res) => {
  await prisma.projectPerson.delete({ where: { id: parseInt(req.params.id) } });
  res.json({ success: true });
});

// Materiaal aan project koppelen
router.post('/material', auth, async (req, res) => {
  const { projectId, materialId, quantity, startDate, endDate } = req.body;

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
      error: `Niet genoeg beschikbaar. Voorraad: ${material.totalStock}, al geboekt: ${alreadyBooked}, beschikbaar: ${material.totalStock - alreadyBooked}`
    });
  }

  const booking = await prisma.projectMaterial.create({
    data: {
      projectId:  parseInt(projectId),
      materialId: parseInt(materialId),
      quantity:   parseInt(quantity),
      startDate:  startDate ? new Date(startDate) : null,
      endDate:    endDate   ? new Date(endDate)   : null
    },
    include: { material: true }
  });
  res.json(booking);
});

// Materiaal van project verwijderen
router.delete('/material/:id', auth, async (req, res) => {
  await prisma.projectMaterial.delete({ where: { id: parseInt(req.params.id) } });
  res.json({ success: true });
});

module.exports = router;
