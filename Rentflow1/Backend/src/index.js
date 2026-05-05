const express = require('express');
const cors    = require('cors');
const app     = express();

app.use(cors());
app.use(express.json());

app.use('/api/auth',      require('./routes/auth'));
app.use('/api/projects',  require('./routes/projects'));
app.use('/api/people',    require('./routes/people'));
app.use('/api/materials', require('./routes/materials'));
app.use('/api/bookings',  require('./routes/bookings'));

app.listen(3001, () => console.log('RentFlow backend draait op poort 3001'));
