const mongoose = require("mongoose");

const adoptionSchema = new mongoose.Schema({
  parent: { 
    type: String, 
    required: true 
  },
  child: { 
    type: String, 
    required: true, 
    unique: true // Prevents multiple parents for the same child
  },
  adoptedAt: { 
    type: Date, 
    default: Date.now 
  },
  // In adoptionSchema
grounded: {
  type: Boolean,
  default: false,
},
groundedUntil: {
  type: Date,
  default: null,
},

});

module.exports = mongoose.model("adoption", adoptionSchema);
