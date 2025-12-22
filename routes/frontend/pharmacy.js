// routes/pharmacy.js
const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
  const pharmacies = [
    { id: 1, name: 'Health First' },
    { id: 2, name: 'MediCare' },
    { id: 3, name: 'LifePharm' },
    { id: 4, name: 'PharmaHub' },
    { id: 5, name: 'Wellness Pharmacy' },
    { id: 6, name: 'PharmaZone' },
    { id: 7, name: 'Vital Drugs' },
    { id: 8, name: 'CareRx' },
    { id: 9, name: 'CureAid' },
    { id: 10, name: 'HealthPoint' }
  ];
  res.render('pharmacy', {
    pharmacies
  });
});

module.exports = router;

