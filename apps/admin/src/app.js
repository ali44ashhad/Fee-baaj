"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sessionMiddleware = void 0;
// admin-app/src/app.ts
require('module-alias/register');
const express_1 = __importDefault(require("express"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const morgan_1 = __importDefault(require("morgan"));
const cors_1 = __importDefault(require("cors"));
const lib_1 = require("@elearning/lib");
const env = __importStar(require("dotenv"));
const passport_1 = __importDefault(require("@/lib/passport"));
const express_session_1 = __importDefault(require("express-session"));
const connect_mongo_1 = __importDefault(require("connect-mongo"));
const config_1 = __importDefault(require("./config"));
env.config();
const isProd = process.env.NODE_ENV === 'production';
const app = (0, express_1.default)();
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
app.use((0, cors_1.default)({
    origin: [config_1.default.web.host],
    credentials: true,
}));
app.use((0, morgan_1.default)('dev'));
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
// Response wrapper (keep as you had it)
app.use(lib_1.responseHandler);
// Session setup — match the working user app pattern
exports.sessionMiddleware = (0, express_session_1.default)({
    secret: process.env.SESSION_SECRET || 'anythin', // use a real secret from env in prod
    resave: false,
    saveUninitialized: false,
    store: connect_mongo_1.default.create({
        mongoUrl: config_1.default.db.url,
        dbName: config_1.default.db.name,
        collectionName: 'sessions',
        ttl: 60 * 60 * 24 * 365,
    }),
    cookie: {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production", // only send cookie over HTTPS in production
        sameSite: 'none', // required for cross-site cookies when using subdomains
        domain: '.freebaj.net', // keep if you want cookie shared across subdomains
        maxAge: 1000 * 60 * 60 * 24 * 365,
    },
});
app.use(exports.sessionMiddleware);
app.use(passport_1.default.initialize());
app.use(passport_1.default.session());
// Mount all module routes
const modulesPath = path_1.default.join(__dirname, 'modules');
fs_1.default.readdirSync(modulesPath).forEach((file) => {
    const router = require(path_1.default.join(modulesPath, file, 'route')).default;
    app.use(`/api/${file}`, router);
});
app.use(lib_1.errorHandler);
exports.default = app;
