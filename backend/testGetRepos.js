const mongoose = require('mongoose');
const User = require('./src/models/User.model');
const Repository = require('./src/models/Repository.model');
const GitObject = require('./src/models/GitObject.model');
require('dotenv').config();

async function test() {
  await mongoose.connect(process.env.MONGODB_URI);
  
  const user = await User.findOne({ username: 'arnav' });
  const pushedRepoIds = await GitObject.distinct('repositoryId', { pushedBy: user._id });
  const repos = await Repository.find({
      $or: [
          { owner: user._id },
          { _id: { $in: pushedRepoIds } }
      ]
  })
      .populate('owner', 'username email name profilePicture')
      .sort({ updatedAt: -1 });
      
  console.log(JSON.stringify(repos, null, 2));
  process.exit(0);
}
test();
