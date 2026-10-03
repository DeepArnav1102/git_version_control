require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../src/models/User.model');

async function fixDB() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        // Unset the profilePicture for users who were given the dummy github identicon
        await User.updateMany(
            { profilePicture: { $regex: /avatars\.githubusercontent\.com/ } },
            { $unset: { profilePicture: "" } }
        );
        console.log('Fixed DB');
    } catch(e) {
        console.error(e);
    } finally {
        await mongoose.disconnect();
    }
}
fixDB();
