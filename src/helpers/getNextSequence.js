// src/helpers/getNextSequence.js
const Counter = require('../models/counter.model');

async function getNextSequence(name) {
    const counter = await Counter.findByIdAndUpdate(
        name,
        { $inc: { sequence_value: 1 } },
        { new: true, upsert: true } // create if doesn't exist
    );
    return counter.sequence_value;
}

module.exports = getNextSequence;
