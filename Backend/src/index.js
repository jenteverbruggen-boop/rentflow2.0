const express = require('express');
const cors    = require('cors');
const app     = express();

app.use(cors({ origin: process.env.FRONTEND_URL }));
app.use(express.json());

app.use('/api/auth',      require('./routes/auth'));
app.use('/api/projects',  require('./routes/Projects'));
app.use('/api/people',    require('./routes/people'));
app.use('/api/materials', require('./routes/materials'));
app.use('/api/bookings',  require('./routes/bookings'));

app.listen(3001, () => console.log('RentFlow backend running on port 3001'));
