const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
const childCareStores = [
    { id: 1, name: 'Baby Planet',image:'/child/child1.jpg'},
    { id: 2, name: 'KiddoCare',image:'/child/child1.jpg'},
    { id: 3, name: 'Little Steps',image:'/child/child1.jpg'},
    { id: 4, name: 'NewBorns',image:'/child/child1.jpg'},
    { id: 5, name: 'TinyToes',image:'/child/child1.jpg'},
    { id: 6, name: 'Mum & Baby',image:'/child/child1.jpg'},
    { id: 7, name: 'BabyMart',image:'/child/child1.jpg'},
    { id: 8, name: 'Care4Kids',image:'/child/child1.jpg'},
    { id: 9, name: 'SweetBaby',image:'/child/child1.jpg'},
    { id: 10, name: 'Toddler Town',image:'/child/child1.jpg'}
  ];
 res.render('child', {
    childCareStores
  });
});
 module.exports = router; 