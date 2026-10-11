require('dotenv').config();
const path = require('path');
const fs = require('fs');
const { R2StorageService } = require('../src/services/r2Storage.service');

(async () => {
    try {
        console.log('--- Cloudflare R2 Binary Uploader ---');
        console.log('Account ID:', process.env.R2_ACCOUNT_ID);
        console.log('Bucket:', process.env.R2_BUCKET_NAME);

        // Path to compiled rusty.exe
        const releaseExePath = path.resolve(__dirname, '../../rusty/target/release/rusty.exe');
        const debugExePath = path.resolve(__dirname, '../../rusty/target/debug/rusty.exe');

        let exePath = null;
        if (fs.existsSync(releaseExePath)) {
            exePath = releaseExePath;
            console.log('Found release binary:', releaseExePath);
        } else if (fs.existsSync(debugExePath)) {
            exePath = debugExePath;
            console.log('Found debug binary:', debugExePath);
        } else {
            console.error('Error: Could not find rusty.exe in rusty/target/release or rusty/target/debug.');
            console.error('Run "cargo build --release" in d:\\project\\git_project\\rusty first.');
            process.exit(1);
        }

        const stats = fs.statSync(exePath);
        console.log(`Binary size: ${(stats.size / (1024 * 1024)).toFixed(2)} MB`);

        console.log('\nUploading rusty.exe to Cloudflare R2...');
        const result = await R2StorageService.uploadExecutable({
            filePath: exePath,
            platform: 'windows',
            version: 'latest',
        });

        console.log('Upload successful!');
        console.log('R2 Key:', result.key);
        console.log('Download / Public URL:', result.downloadUrl);
        if (result.publicUrl) {
            console.log('Public R2.dev URL:', result.publicUrl);
        }

        process.exit(0);
    } catch (err) {
        console.error('Upload failed with error:', err);
        process.exit(1);
    }
})();
