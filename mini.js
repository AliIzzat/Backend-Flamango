// mini.js
const express = require('express');
const app = express();

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.get('/__who', (req, res) => {
  res.json({
    who: 'MINI SERVER',
    pid: process.pid,
    cwd: process.cwd(),
    time: new Date().toISOString()
  });
});

app.post('/create-checkout-session', (req, res) => {
  console.log('🧪 MINI HANDLER HIT /create-checkout-session');
  console.log('🧾 req.body =', req.body);
  res.status(200).json({ ok: true, body: req.body });
});

const PORT = 4000; // use 4000 to avoid conflicts
app.listen(PORT, () => console.log(`🚀 MINI listening on http://localhost:${PORT}`));
