const mongoose = require('mongoose');
const grocerySchema = new mongoose.Schema({
  name: String,
  image: String
});
module.exports = mongoose.model('Grocery', grocerySchema);
