"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const lib_1 = require("@elearning/lib");
const schemas_1 = require("@elearning/schemas");
const express_1 = __importDefault(require("express"));
const controller_1 = require("./controller");
const router = express_1.default.Router();
// // Set up multer storage (temporary disk storage)
// const storage = multer.diskStorage({
//   destination: (req, file, cb) => {
//     cb(null, 'uploads/'); // Temporary folder for uploads
//   },
//   filename: (req, file, cb) => {
//     cb(null, `${Date.now()}-${file.originalname}`);
//   },
// });
// const upload = multer({
//   storage,
//   limits: { fileSize: 10 * 1024 * 1024 * 1000 }, // e.g. 10GB max
// });
// // Define allowed fields for upload
// const uploadFields = upload.fields([
//   { name: 'video', maxCount: 1 },
//   { name: 'thumbnail', maxCount: 1 },
// ]);
// Route handling file upload and passing data to the controller
router.post('/', (0, lib_1.validate)(schemas_1.CourseSaveSchema), controller_1.create); // metadata-only
router.put('/:id', (0, lib_1.validate)(schemas_1.CourseSaveSchema), controller_1.update); // metadata only
router.get('/', controller_1.list);
router.get('/:id', controller_1.read);
router.delete('/:id', controller_1.remove);
exports.default = router;
