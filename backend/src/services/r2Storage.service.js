const { S3Client, PutObjectCommand, GetObjectCommand, HeadObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const AdmZip = require('adm-zip');
const logger = require('../utils/logger');

const accountId = process.env.R2_ACCOUNT_ID;
const accessKeyId = process.env.R2_ACCESS_KEY_ID;
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
const bucketName = process.env.R2_BUCKET_NAME || 'rusty-binaries';
const publicUrl = (process.env.R2_PUBLIC_URL || '').replace(/\/$/, '');

let s3Client = null;

function getS3Client() {
    if (!s3Client) {
        if (!accountId || !accessKeyId || !secretAccessKey) {
            throw new Error('Cloudflare R2 credentials (R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY) are missing in environment.');
        }
        s3Client = new S3Client({
            region: 'auto',
            endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
            credentials: {
                accessKeyId,
                secretAccessKey,
            },
        });
    }
    return s3Client;
}

class R2StorageService {
    /**
     * Upload an executable file to Cloudflare R2
     * @param {Object} params
     * @param {string} params.filePath - Local path to the executable file
     * @param {string} [params.platform='windows'] - 'windows' | 'linux'
     * @param {string} [params.version='latest'] - Version tag e.g. 'latest' or 'v0.1.0'
     */
    static async uploadExecutable({ filePath, platform = 'windows', version = 'latest' }) {
        const client = getS3Client();
        const fileName = platform === 'windows' ? 'rusty.exe' : 'rusty';
        const key = `${version}/${platform}/${fileName}`;

        const fileStream = fs.createReadStream(filePath);
        const stats = await fsp.stat(filePath);

        const uploadCommand = new PutObjectCommand({
            Bucket: bucketName,
            Key: key,
            Body: fileStream,
            ContentLength: stats.size,
            ContentType: 'application/octet-stream',
            Metadata: {
                platform,
                version,
                uploadedAt: new Date().toISOString(),
            },
        });

        await client.send(uploadCommand);
        logger.info(`Uploaded executable ${fileName} to Cloudflare R2 key: ${key}`);

        const downloadUrl = publicUrl ? `${publicUrl}/${key}` : await this.getPresignedDownloadUrl({ platform, version });

        return {
            key,
            bucket: bucketName,
            sizeBytes: stats.size,
            downloadUrl,
            publicUrl: publicUrl ? `${publicUrl}/${key}` : null,
        };
    }

    /**
     * Check if executable exists in Cloudflare R2
     */
    static async checkExecutableExists({ platform = 'windows', version = 'latest' }) {
        const client = getS3Client();
        const fileName = platform === 'windows' ? 'rusty.exe' : 'rusty';
        const key = `${version}/${platform}/${fileName}`;

        try {
            await client.send(new HeadObjectCommand({ Bucket: bucketName, Key: key }));
            return true;
        } catch (error) {
            if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
                return false;
            }
            throw error;
        }
    }

    /**
     * Generate a presigned download URL for the executable (valid for 1 hour)
     */
    static async getPresignedDownloadUrl({ platform = 'windows', version = 'latest', expiresIn = 3600 }) {
        const client = getS3Client();
        const fileName = platform === 'windows' ? 'rusty.exe' : 'rusty';
        const key = `${version}/${platform}/${fileName}`;

        const command = new GetObjectCommand({
            Bucket: bucketName,
            Key: key,
        });

        return await getSignedUrl(client, command, { expiresIn });
    }

    /**
     * Downloads and caches the executable locally from Cloudflare R2 to a destination directory.
     * Used by Codespaces to ensure the rusty binary is available in the workspace.
     * @param {Object} params
     * @param {string} params.targetDir - Local directory where binary should be stored
     * @param {string} [params.platform='windows']
     * @param {string} [params.version='latest']
     * @returns {Promise<string>} Full path to cached local binary
     */
    static async downloadAndCacheExecutable({ targetDir, platform = 'windows', version = 'latest' }) {
        await fsp.mkdir(targetDir, { recursive: true });
        const fileName = platform === 'windows' ? 'rusty.exe' : 'rusty';
        const localFilePath = path.join(targetDir, fileName);

        // If file already exists and is not empty, use cached version
        try {
            const stats = await fsp.stat(localFilePath);
            if (stats.size > 0) {
                return localFilePath;
            }
        } catch (_) {
            // File does not exist, proceed to download from R2
        }

        const client = getS3Client();
        const key = `${version}/${platform}/${fileName}`;

        logger.info(`Fetching ${fileName} from Cloudflare R2 (key: ${key})...`);
        const response = await client.send(new GetObjectCommand({
            Bucket: bucketName,
            Key: key,
        }));

        const writeStream = fs.createWriteStream(localFilePath);
        await new Promise((resolve, reject) => {
            response.Body.pipe(writeStream);
            writeStream.on('finish', resolve);
            writeStream.on('error', reject);
        });

        // Set executable permissions if on Unix/Linux
        if (platform !== 'windows') {
            await fsp.chmod(localFilePath, 0o755).catch(() => {});
        }

        logger.info(`Cached ${fileName} successfully to ${localFilePath}`);
        return localFilePath;
    }

    /**
     * Snapshots the installed Python packages (.local directory) and uploads to Cloudflare R2.
     * @param {Object} params
     * @param {string} params.owner - Repository owner username
     * @param {string} params.repo - Repository name
     * @param {string} params.localEnvPath - Absolute path to .local directory in workspace
     * @returns {Promise<boolean>}
     */
    static async savePythonEnvironment({ owner, repo, localEnvPath }) {
        try {
            // Check if directory exists and is non-empty
            try {
                const stats = await fsp.stat(localEnvPath);
                if (!stats.isDirectory()) return false;
                const entries = await fsp.readdir(localEnvPath);
                if (entries.length === 0) return false;
            } catch (_) {
                return false; // Directory does not exist, nothing to save
            }

            const client = getS3Client();
            const key = `envs/${owner}/${repo}/python_env.zip`;

            logger.info(`Zipping and uploading Python environment for ${owner}/${repo} to R2 (key: ${key})...`);

            const zip = new AdmZip();
            zip.addLocalFolder(localEnvPath);
            const zipBuffer = zip.toBuffer();

            const uploadCommand = new PutObjectCommand({
                Bucket: bucketName,
                Key: key,
                Body: zipBuffer,
                ContentLength: zipBuffer.length,
                ContentType: 'application/zip',
                Metadata: {
                    owner,
                    repo,
                    savedAt: new Date().toISOString(),
                },
            });

            await client.send(uploadCommand);
            logger.info(`Successfully saved Python environment snapshot (${(zipBuffer.length / (1024 * 1024)).toFixed(2)} MB) to Cloudflare R2!`);
            return true;
        } catch (error) {
            logger.warn(`Failed to save python environment to R2: ${error.message}`);
            return false;
        }
    }

    /**
     * Downloads and restores the Python environment (.local directory) from Cloudflare R2.
     * @param {Object} params
     * @param {string} params.owner - Repository owner username
     * @param {string} params.repo - Repository name
     * @param {string} params.targetEnvPath - Absolute path where .local should be extracted
     * @returns {Promise<boolean>}
     */
    static async restorePythonEnvironment({ owner, repo, targetEnvPath }) {
        try {
            const client = getS3Client();
            const key = `envs/${owner}/${repo}/python_env.zip`;

            // Check if environment snapshot exists in R2
            try {
                await client.send(new HeadObjectCommand({ Bucket: bucketName, Key: key }));
            } catch (err) {
                if (err.name === 'NotFound' || err.$metadata?.httpStatusCode === 404) {
                    return false; // No saved environment found
                }
                throw err;
            }

            logger.info(`Found saved Python environment in R2 for ${owner}/${repo}. Downloading & restoring...`);
            const response = await client.send(new GetObjectCommand({
                Bucket: bucketName,
                Key: key,
            }));

            // Convert readable stream to buffer
            const chunks = [];
            for await (const chunk of response.Body) {
                chunks.push(chunk);
            }
            const buffer = Buffer.concat(chunks);

            await fsp.mkdir(targetEnvPath, { recursive: true });
            const zip = new AdmZip(buffer);
            zip.extractAllTo(targetEnvPath, true);

            logger.info(`Successfully restored Python environment for ${owner}/${repo} from Cloudflare R2!`);
            return true;
        } catch (error) {
            logger.warn(`Failed to restore python environment from R2: ${error.message}`);
            return false;
        }
    }
}

module.exports = { R2StorageService };
