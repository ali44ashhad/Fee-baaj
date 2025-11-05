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
Object.defineProperty(exports, "__esModule", { value: true });
const env = __importStar(require("dotenv"));
env.config();
exports.default = {
    api: {
        port: process.env.PORT,
        name: process.env.APP_NAME,
        url: process.env.APP_URL,
    },
    media: {
        url: process.env.MEDIA_URL,
        base_dir: process.env.MEDIA_BASE_DIR,
    },
    web: {
        url: process.env.WEB_URL || 'http://localhost:3000',
        host: process.env.WEB_HOST,
    },
    db: {
        name: process.env.DB_NAME,
        url: process.env.DB_URL,
    },
    jwt: {
        expiresAt: parseInt(process.env.JWT_EXPIRES_IN || '24'),
        secret: process.env.JWT_SECRET || 'testingdev123',
    },
    mail: {
        service: process.env.MAIL_SERVICE,
        username: process.env.MAIL_USERNAME,
        password: process.env.MAIL_PASSWORD,
        from: process.env.MAIL_FROM,
    },
    bunny: {
        BUNNY_HOST_NAME: process.env.BUNNY_HOST_NAME,
        BUNNY_IMG_HOSTNAME: process.env.BUNNY_IMG_HOSTNAME,
        BUNNY_IMAGE_STORAGE_API_KEY: process.env.BUNNY_IMAGE_STORAGE_API_KEY,
        BUNNY_STORAGE_ZONE: process.env.BUNNY_STORAGE_ZONE,
        BUNNY_VIDEO_LIBRARY_ID: process.env.BUNNY_VIDEO_LIBRARY_ID,
        BUNNY_STREAM_API_KEY: process.env.BUNNY_STREAM_API_KEY,
    }
};
