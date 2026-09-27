const express = require('express');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const cors = require('cors');

const authRouter = require('./routes/auth.route');
const tokenRouter = require('./routes/token.route');
const userRouter = require('./routes/user.route');
const ideRouter = require('./routes/ide.route');
const errorHandler = require('./middlewares/error.middleware');

const app = express();
const setupSwagger = require('./swagger');

// Initialize Swagger docs
setupSwagger(app);

app.use(helmet());
app.use(cors({
    origin: true, // Dynamically reflects the request origin
    credentials: true,
}));
app.use(cookieParser());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

const repoRouter = require('./routes/repo.route');
const { protect } = require('./middlewares/auth.middleware');
const { checkObjectExists, storeObject, updateRef } = require('./controllers/repo.controller');

app.use('/api/v1/auth', authRouter);
app.use('/api/v1/tokens', tokenRouter);
app.use('/api/v1/users', userRouter);
app.use('/api/v1/ide', ideRouter);
app.use('/api/v1/repos', repoRouter);
app.use('/repos', repoRouter);

// Fallback endpoints for direct push URLs without /api/v1/repos prefix
app.get('/objects/:hash/exists', protect, checkObjectExists);
app.post('/objects', protect, storeObject);
app.post('/refs', protect, updateRef);

app.use(errorHandler);

module.exports = app;