"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.list = void 0;
const lib_1 = require("@elearning/lib");
const models_1 = require("@elearning/models");
exports.list = (0, lib_1.asyncHandler)(async (req, res) => {
    const courses = await models_1.Course.countDocuments({ published: true });
    const enrollments = await models_1.Enrollment.countDocuments();
    const reviews = await models_1.Review.countDocuments({ approved: true });
    const students = await models_1.User.countDocuments({ active: true });
    return res.out({ courses, enrollments, reviews, students });
});
