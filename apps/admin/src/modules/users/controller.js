"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.remove = exports.read = exports.list = exports.update = exports.create = void 0;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const mainController_1 = require("@/lib/mainController");
const lib_1 = require("@elearning/lib");
const models_1 = require("@elearning/models");
exports.create = (0, lib_1.asyncHandler)(async (req, res) => {
    if (req.body.password) {
        req.body.password = await bcryptjs_1.default.hash(req.body.password, lib_1.PASSWORD_HASH_SALT);
    }
    mainController_1.mainController.create(req, res, models_1.User);
});
exports.update = (0, lib_1.asyncHandler)(async (req, res) => {
    if (req.body.password) {
        req.body.password = await bcryptjs_1.default.hash(req.body.password, lib_1.PASSWORD_HASH_SALT);
    }
    mainController_1.mainController.update(req, res, models_1.User);
});
exports.list = (0, lib_1.asyncHandler)(async (req, res) => {
    mainController_1.mainController.list(req, res, models_1.User);
});
exports.read = (0, lib_1.asyncHandler)(async (req, res) => {
    mainController_1.mainController.read(req, res, models_1.User);
});
exports.remove = (0, lib_1.asyncHandler)(async (req, res) => {
    mainController_1.mainController.remove(req, res, models_1.User);
});
