const mongoose = require('mongoose');
const User = require('./src/models/User.model');
require('dotenv').config();

async function test() {
  await mongoose.connect(process.env.MONGODB_URI);
  
  const arnav = await User.findOne({ username: 'arnav' });
  console.log("Arnav pinned repos:", arnav.pinnedRepos);
  
  process.exit(0);
}
test();
