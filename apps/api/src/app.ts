require('module-alias/register');

import express from 'express';
import path from 'path';
import fs from 'fs';
import morgan from 'morgan';
import cors from 'cors';
import { errorHandler, responseHandler } from '@elearning/lib';
import * as env from 'dotenv';
import passport from '@/lib/passport';
import session from 'express-session'; 
import MongoStore from 'connect-mongo';
import config from './config';

env.config();
const isProd = process.env.NODE_ENV === 'production';
const app = express();

app.use((req, res, next) => {
  if (req.headers.cookie) {
    req.headers.cookie = req.headers.cookie
      .split(';')
      .map(c => {
        if (c.trim().startsWith('connect.sid=')) {
          const [key, value] = c.split('=');
          return `${key}=${decodeURIComponent(value)}`;
        }
        return c;
      })
      .join('; ');
  }
  next();
});

export const sessionMiddleware = session({
  secret: 'anythin',
  resave: false, 
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: config.db.url,
    dbName: config.db.name,
    collectionName: 'sessions',
    ttl: 60 * 60 * 24 * 365, // one year in seconds
  }),
  cookie: {
    httpOnly: true,
    secure: isProd,          // only over HTTPS
    sameSite: 'none',      // allow cross‑subdomain
    domain: '.freebaj.com',  // IMPORTANT
    maxAge: 1000 * 60 * 60 * 24 * 365,
  },
});


app.set('trust proxy', true);

app.use(
  cors({
    origin: [config.web.url, process.env.WWWW_USER_APP,  process.env.WWWW_USER_APP_COM, process.env.USER_APP_COM],
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
); 

app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Response wrapper
app.use(responseHandler);

// Session & Passport
app.use(sessionMiddleware);
app.use(passport.initialize());
app.use(passport.session());

// Mount all module routes (“/modules/<name>/route.ts”)
const modulesPath = path.join(__dirname, 'modules');
fs.readdirSync(modulesPath).forEach((file) => {
  const router = require(path.join(modulesPath, file, 'route')).default;
  app.use(`/${file}`, router);
});

// Error handler
app.use(errorHandler);

export default app;
