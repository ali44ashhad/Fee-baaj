// admin-app/src/app.ts
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

// If you're behind a proxy/load-balancer (nginx, cloudflare, aws alb), enable trust proxy
// so req.protocol and secure detection will reflect the original client request
app.set('trust proxy', 1);

// Cookie decode shim (some setups double-encode connect.sid)
app.use((req, res, next) => {
  if (req.headers.cookie) {
    req.headers.cookie = req.headers.cookie
      .split(';')
      .map(c => {
        if (c.trim().startsWith('connect.sid=')) {
          const [key, ...rest] = c.split('=');
          const value = rest.join('=');
          return `${key}=${decodeURIComponent(value)}`;
        }
        return c;
      })
      .join('; ');
  }
  next();
});



// CORS: must echo the incoming origin (not '*') when credentials: true
app.use(
  cors({
    origin: [config.web.host],
    credentials: true,
  }),

);

app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Response wrapper (keep as you had it)
app.use(responseHandler);

// Session setup — match the working user app pattern
export const sessionMiddleware = session({
  secret: process.env.SESSION_SECRET || 'anythin', // use a real secret from env in prod
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: config.db.url,
    dbName: config.db.name,
    collectionName: 'sessions',
    ttl: 60 * 60 * 24 * 365,
  }),
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",            // only send cookie over HTTPS in production
    sameSite: 'none',         // required for cross-site cookies when using subdomains
    domain: '.freebaj.net',   // keep if you want cookie shared across subdomains
    maxAge: 1000 * 60 * 60 * 24 * 365,
  },
});

app.use(sessionMiddleware);
app.use(passport.initialize());
app.use(passport.session());

// Mount all module routes
const modulesPath = path.join(__dirname, 'modules');
fs.readdirSync(modulesPath).forEach((file) => {
  const router = require(path.join(modulesPath, file, 'route')).default;
  app.use(`/api/${file}`, router);
});

app.use(errorHandler);

export default app;
