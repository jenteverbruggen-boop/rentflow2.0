const express = require('express');
const router  = express.Router();
const auth    = require('../middleware/auth');
const { PrismaClient } = require('@prisma/client');
const prisma  = new PrismaClient();

router.get('/', auth, async (req, res) => {
  const people = await prisma.person.findMany({ orderBy: { name: 'asc' } });
  res.json(people);
});

router.post('/', auth, async (req, res) => {
  const { name, role, email, phone } = req.body;
  const person = await prisma.person.create({ data: { name, role, email, phone } });
  res.json(person);
});

router.put('/:id', auth, async (req, res) => {
  const { name, role, email, phone } = req.body;
  const person = await prisma.person.update({
    where: { id: parseInt(req.params.id) },
    data:  { name, role, email, phone }
  });
  res.json(person);
});

router.delete('/:id', auth, async (req, res) => {
  await prisma.person.delete({ where: { id: parseInt(req.params.id) } });
  res.json({ success: true });
});

module.exports = router;
