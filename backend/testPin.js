const mongoose = require('mongoose');
const User = require('./src/models/User.model');
const Repository = require('./src/models/Repository.model');
require('dotenv').config();

async function test() {
  await mongoose.connect(process.env.MONGODB_URI);
  
  const arnav = await User.findOne({ username: 'arnav' });
  if (!arnav) {
    console.log('Arnav not found');
    process.exit(1);
  }
  
  const repos = await Repository.find({ owner: arnav._id });
  console.log(`Arnav has ${repos.length} repos`);
  
  if (repos.length > 0) {
    console.log("Repos:", repos.map(r => r.name));
    // simulate the endpoint logic
    const pinnedRepos = [repos[0]._id.toString()];
    
    const validRepos = await Repository.find({ _id: { $in: pinnedRepos }, owner: arnav._id });
    console.log(`Valid repos found: ${validRepos.length}. Expected: ${pinnedRepos.length}`);
  }
  
  process.exit(0);
}
test();
