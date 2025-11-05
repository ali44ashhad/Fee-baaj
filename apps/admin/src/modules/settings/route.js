"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const lib_1 = require("@elearning/lib");
const controller_1 = require("./controller");
const schemas_1 = require("@elearning/schemas");
const router = express_1.default.Router();
router.put('/', (0, lib_1.validate)(schemas_1.SettingSaveSchema), controller_1.update);
router.get('/', controller_1.read);
exports.default = router;
