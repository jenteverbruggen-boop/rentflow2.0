const express  = require('express');
const router   = express.Router();
const bcrypt   = require('bcryptjs');
const jwt      = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const prisma   = new PrismaClient();

// Registreren
router.post('/register', async (req, res) => {
  const { email, password, name } = req.body;
  if (!email || !password || !name)
    return res.status(400).json({ error: 'Alle velden zijn verplicht' });

  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) return res.status(400).json({ error: 'Email al in gebruik' });

  const hashed = await bcrypt.hash(password, 10);
  const user   = await prisma.user.create({
    data: { email, password: hashed, name }
  });

  const token = jwt.sign(
    { id: user.id, email: user.email, name: user.name },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );

  res.json({ token, user: { id: user.id, email: user.email, name: user.name } });
});

// Inloggen
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return res.status(401).json({ error: 'Ongeldig email of wachtwoord' });

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) return res.status(401).json({ error: 'Ongeldig email of wachtwoord' });

  const token = jwt.sign(
    { id: user.id, email: user.email, name: user.name },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );

  res.json({ token, user: { id: user.id, email: user.email, name: user.name } });
});

module.exports = router;
