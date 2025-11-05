"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.remove = exports.read = exports.list = exports.update = exports.create = void 0;
const mainController_1 = require("@/lib/mainController");
const lib_1 = require("@elearning/lib");
const models_1 = require("@elearning/models");
exports.create = (0, lib_1.asyncHandler)(async (req, res) => {
    mainController_1.mainController.create(req, res, models_1.Category);
});
exports.update = (0, lib_1.asyncHandler)(async (req, res) => {
    mainController_1.mainController.update(req, res, models_1.Category);
});
exports.list = (0, lib_1.asyncHandler)(async (req, res) => {
    mainController_1.mainController.list(req, res, models_1.Category);
});
exports.read = (0, lib_1.asyncHandler)(async (req, res) => {
    mainController_1.mainController.read(req, res, models_1.Category);
});
exports.remove = (0, lib_1.asyncHandler)(async (req, res) => {
    mainController_1.mainController.remove(req, res, models_1.Category);
});
