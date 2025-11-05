"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const lib_1 = require("@elearning/lib");
const schemas_1 = require("@elearning/schemas");
const multer_1 = __importDefault(require("multer"));
const express_1 = __importDefault(require("express"));
const controller_1 = require("./controller");
const router = express_1.default.Router();
// Set up multer storage (temporary disk storage)
const storage = multer_1.default.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/'); // Temporary folder for uploads
    },
    filename: (req, file, cb) => {
        cb(null, `${Date.now()}-${file.originalname}`);
    },
});
const upload = (0, multer_1.default)({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 * 1000 }, // e.g. 10GB max
});
const uploadFields = upload.fields([
    { name: 'video', maxCount: 1 },
]);
router.post('/', (0, lib_1.validate)(schemas_1.ChapterSaveSchema), controller_1.create);
router.put('/:id', (0, lib_1.validate)(schemas_1.ChapterUpdateSchema), controller_1.update);
router.get('/', controller_1.list);
router.get('/:id', controller_1.read);
router.delete('/:id', controller_1.remove);
//router.delete('/:id', remove);
router.post('/:id/lectures', uploadFields, (0, lib_1.validate)(schemas_1.LectureSaveSchema), controller_1.addLecture);
router.put('/:id/lectures/:lectureId', uploadFields, (0, lib_1.validate)(schemas_1.LectureSaveSchema), controller_1.updateLecture);
router.delete('/:id/lectures/:lectureId', controller_1.removeLecture);
exports.default = router;
