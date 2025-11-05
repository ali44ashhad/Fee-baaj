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
// Now: expect JSON body; no multer or file uploads handled by Admin API.
// The media server handles image uploads and will send back pictureId/pictureUrl to be stored in the user record.
router.post('/', (0, lib_1.validate)(schemas_1.UserSaveSchema), controller_1.create);
router.put('/:id', (0, lib_1.validate)(schemas_1.UserSaveSchema), controller_1.update);
router.get('/', controller_1.list);
router.get('/:id', controller_1.read);
router.delete('/:id', controller_1.remove);
exports.default = router;
