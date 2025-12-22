const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
const bodybuildingStores = [
    { id: 1, name: 'Muscle Max' },
    { id: 2, name: 'PowerFuel' },
    { id: 3, name: 'Protein Planet' },
    { id: 4, name: 'Gains Store' },
    { id: 5, name: 'BulkUp' },
    { id: 6, name: 'IronFuel' },
    { id: 7, name: 'FitStrong' },
    { id: 8, name: 'SupplePro' },
    { id: 9, name: 'ShredTech' },
    { id: 10, name: 'Muscle King' }
  ];
   res.render('sport', {
    bodybuildingStores
  });
});
module.exports = router;