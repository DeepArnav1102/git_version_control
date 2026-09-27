const mongoose = require('mongoose');
const GitObject = require('./src/models/GitObject.model');
const User = require('./src/models/User.model');
require('dotenv').config();

async function test() {
  await mongoose.connect(process.env.MONGODB_URI);
  
  const user = await User.findOne({ username: 'arnav' });
  if (!user) {
    console.log("User arnav not found");
    process.exit(1);
  }
  
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 365);
  
  const commits = await GitObject.aggregate([
      {
          $match: {
              pushedBy: user._id,
              type: 'commit',
              createdAt: { $gte: startDate, $lte: endDate }
          }
      },
      {
          $group: {
              _id: {
                  $dateToString: { format: "%Y-%m-%d", date: "$createdAt" }
              },
              count: { $sum: 1 }
          }
      },
      { $sort: { _id: 1 } }
  ]);
  
  console.log("Commits aggregation result:", JSON.stringify(commits, null, 2));
  process.exit(0);
}
test();
