require('dotenv').config();
const mongoose = require('mongoose');
const PullRequest = require('../src/models/PullRequest.model');

async function migrate() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');

        const result = await PullRequest.updateMany(
            { assignees: { $exists: false } },
            { 
                $set: { 
                    assignees: [], 
                    reviewers: [], 
                    labels: [],
                    milestone: null,
                    project: null
                } 
            }
        );

        console.log(`Migration completed. Modified ${result.modifiedCount} documents.`);
    } catch (err) {
        console.error('Migration failed:', err);
    } finally {
        await mongoose.disconnect();
        console.log('Disconnected from MongoDB');
    }
}

migrate();
