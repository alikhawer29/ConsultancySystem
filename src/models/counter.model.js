// src/models/counter.model.js
const mongoose = require('mongoose');

const counterSchema = new mongoose.Schema({
    _id: { type: String, required: true }, // e.g., "booking"
    sequence_value: { type: Number, default: 1000 }
});

module.exports = mongoose.model('Counter', counterSchema);
