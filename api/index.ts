import express from 'express';
import cookieParser from 'cookie-parser';
import { apiRouter } from '../src/server/api';

const app = express();

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Mount apiRouter on both /api and root /
app.use('/api', apiRouter);
app.use('/', apiRouter);

export default app;
