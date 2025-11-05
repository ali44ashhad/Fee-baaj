"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.read = exports.update = void 0;
const mainController_1 = require("@/lib/mainController");
const lib_1 = require("@elearning/lib");
const models_1 = require("@elearning/models");
exports.update = (0, lib_1.asyncHandler)(async (req, res) => {
    req.params.id = "67ccc9222bbc2e6cdb51e944";
    mainController_1.mainController.update(req, res, models_1.Setting);
});
exports.read = (0, lib_1.asyncHandler)(async (req, res) => {
    req.params.id = "67ccc9222bbc2e6cdb51e944";
    mainController_1.mainController.read(req, res, models_1.Setting);
});
