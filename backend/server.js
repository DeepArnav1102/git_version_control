const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const dns = require('dns');
dns.setDefaultResultOrder('ipv4first');
const mongoose = require('mongoose');
const app = require('./src/app.js');
const connectDb = require('./src/db/db.js');
const logger = require('./src/utils/logger.js');

const PORT = process.env.PORT || 5000;
let server;

const startApplication = async () => {
    try {   
        if (connectDb) {
            await connectDb();
        }
        
        server = app.listen(PORT, () => {
            logger.info(`Server is running successfully at port ${PORT}`);
        });

        const { initTerminalServer } = require('./src/services/terminal.service.js');
        const wss = initTerminalServer(server);

        server.on('upgrade', (request, socket, head) => {
            if (request.url === '/ws/terminal') {
                wss.handleUpgrade(request, socket, head, (ws) => {
                    wss.emit('connection', ws, request);
                });
            } else {
                socket.destroy();
            }
        });

        server.on('error', (error) => {
            if (error.syscall !== 'listen') {
                throw error;
            }

            switch (error.code) {
                case 'EADDRINUSE':
                    logger.error(`Port ${PORT} is already in use. ❌`);
                    process.exit(1);
                    break;
                case 'EACCES':
                    logger.error(`Port ${PORT} requires elevated privileges. ❌`);
                    process.exit(1);
                    break;
                default:
                    logger.error(`Server encountered an error:`, error);
                    process.exit(1);
            }
        });

    } catch (error) {
        logger.error(`Failed to initialize application! ❌: ${error.message}`, { stack: error.stack });
        process.exit(1);
    }
};

const gracefulShutdown = async (signal) => {
    logger.info(`\nStopping server due to signal: ${signal}`);
    
    const shutdownTimeout = setTimeout(() => {
        logger.error("Could not close connections in time, forcefully shutting down. ⚠️");
        process.exit(1);
    }, 10000);

    try {
        if (server) {
            await new Promise((resolve) => server.close(resolve));
            logger.info('HTTP server closed, no longer accepting requests. ✅');
        }

        if (mongoose.connection && mongoose.connection.readyState !== 0) {
            await mongoose.connection.close();
            logger.info('Database connection closed. ✅');
        }

        // Clean up orphaned Docker containers using Dockerode (Cross-platform)
        try {
            const Docker = require('dockerode');
            const docker = new Docker(process.platform === 'win32' ? { socketPath: '//./pipe/docker_engine' } : { socketPath: '/var/run/docker.sock' });
            const containers = await docker.listContainers({ all: true, filters: { ancestor: ['python:3.11-slim'] } });
            
            for (const cInfo of containers) {
                try {
                    const c = docker.getContainer(cInfo.Id);
                    await c.remove({ force: true });
                } catch (e) {}
            }
            logger.info('Docker sandbox containers cleaned up. ✅');
        } catch (err) {
            logger.error('Failed to clean up Docker containers: ' + err.message);
        }

        clearTimeout(shutdownTimeout);
        logger.info('Graceful shutdown completed successfully. ✅');
        process.exit(0);
    } catch (error) {
        logger.error(`Error during graceful shutdown: ❌ ${error.message}`, { stack: error.stack });
        clearTimeout(shutdownTimeout);
        process.exit(1);
    }
};

startApplication();

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

process.on('uncaughtException', (error) => {
    logger.error(`Uncaught Exception! ⚠️: ${error.message}`, { stack: error.stack });
    gracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason, promise) => {
    logger.error(`Unhandled Rejection at: ${promise} reason: ${reason}`);
    gracefulShutdown('unhandledRejection');
});
