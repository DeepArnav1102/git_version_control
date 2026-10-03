require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../src/models/User.model');

async function updateAvatars() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');

        // Provide real dummy avatar URLs for testing
        await User.updateOne({ username: 'arpan_dhara' }, { $set: { profilePicture: 'https://avatars.githubusercontent.com/u/10000000?v=4' } });
        await User.updateOne({ username: 'rai' }, { $set: { profilePicture: 'https://avatars.githubusercontent.com/u/20000000?v=4' } });
        await User.updateMany({ $or: [{profilePicture: { $exists: false }}, {profilePicture: null}, {profilePicture: ""}] }, { $set: { profilePicture: 'https://avatars.githubusercontent.com/u/30000000?v=4' } });
        
        console.log('Avatars updated successfully.');
    } catch (err) {
        console.error('Migration failed:', err);
    } finally {
        await mongoose.disconnect();
        console.log('Disconnected from MongoDB');
    }
}

updateAvatars();
