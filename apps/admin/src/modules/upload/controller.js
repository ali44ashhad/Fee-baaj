"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.upload = void 0;
const config_1 = __importDefault(require("@/config"));
const lib_1 = require("@elearning/lib");
exports.upload = (0, lib_1.asyncHandler)(async (req, res) => {
    const path = req.file.path.split('\\').join('/').replace(config_1.default.media.base_dir, '');
    res.out({
        path: path,
        url: `${lib_1.MEDIA_BASE_URL}${path}`,
    });
});
