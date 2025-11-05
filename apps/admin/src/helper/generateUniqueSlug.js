"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const slugify_1 = __importDefault(require("slugify"));
const models_1 = require("@elearning/models");
async function generateUniqueSlug(title, courseId) {
    let baseSlug = (0, slugify_1.default)(title, { lower: true, strict: true });
    let slug = baseSlug;
    let counter = 1;
    while (true) {
        const existing = await models_1.Course.findOne({ slug, _id: { $ne: courseId } });
        if (!existing)
            break;
        slug = `${baseSlug}-${counter++}`;
    }
    return slug;
}
exports.default = generateUniqueSlug;
