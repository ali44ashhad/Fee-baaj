"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const config_1 = __importDefault(require("@/config"));
const express_1 = __importDefault(require("express"));
const fs_1 = __importDefault(require("fs"));
const controller_1 = require("./controller");
const router = express_1.default.Router();
// Simple MIME type to extension mapping
const mimeToExt = {
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png',
};
const multer = require('multer');
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const dateObj = new Date();
        const day = dateObj.getUTCDate();
        const month = dateObj.getUTCMonth() + 1;
        const year = dateObj.getUTCFullYear();
        const fullPath = `${config_1.default.media.base_dir}/${year}/${month}/${day}/`;
        fs_1.default.mkdirSync(fullPath, { recursive: true });
        cb(null, fullPath);
    },
    filename: async function (req, file, cb) {
        const extension = mimeToExt[file.mimetype] || 'jpg';
        cb(null, Date.now() + '.' + extension);
    },
});
const uploadMiddleware = multer({
    storage: storage,
    fileFilter: function (req, file, cb) {
        const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png'];
        if (allowedMimeTypes.includes(file.mimetype)) {
            return cb(null, true);
        }
        cb(`${req.custom.local.unsupported_file_types} (jpeg, jpg, png)`);
    },
});
/**
 * POST /upload
 */
router.post('/', uploadMiddleware.single('picture'), controller_1.upload);
exports.default = router;
