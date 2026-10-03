require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../src/models/User.model');

async function test() {
    await mongoose.connect(process.env.MONGODB_URI);
    const users = await User.find({username: {$in: ['arpan_dhara', 'rai']}});
    console.log(users.map(u => ({u: u.username, a: u.avatarUrl})));
    await mongoose.disconnect();
}
test();
