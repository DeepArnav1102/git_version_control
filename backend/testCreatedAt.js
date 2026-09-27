const mongoose = require('mongoose');
const GitObject = require('./src/models/GitObject.model');
require('dotenv').config();

async function test() {
  await mongoose.connect(process.env.MONGODB_URI);
  
  const obj = await GitObject.findOne({ type: 'commit' });
  console.log("Found commit object:", obj);
  process.exit(0);
}
test();
