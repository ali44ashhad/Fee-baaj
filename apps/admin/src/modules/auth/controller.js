"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logout = exports.checkAuth = exports.login = void 0;
const models_1 = require("@elearning/models");
const types_1 = require("@elearning/types");
const lib_1 = require("@elearning/lib");
exports.login = (0, lib_1.asyncHandler)(async (req, res) => {
    const { email, password } = req.body;
    const admin = await models_1.Admin.findOne({ email });
    if (!admin)
        throw new lib_1.AppError('Email or password is incorrect', types_1.STATUS_MESSAGES.INVALID_USER_AUTHENTICATION);
    const isMatch = await admin.isPasswordCorrect(password);
    if (!isMatch)
        throw new lib_1.AppError('Email or password is incorrect', types_1.STATUS_MESSAGES.INVALID_USER_AUTHENTICATION);
    req.login(admin, (err) => {
        if (err)
            throw new lib_1.AppError('Authentication failed. Please try again.');
        return res.out({ _id: admin.id, name: admin.name, email: admin.email });
    });
});
exports.checkAuth = (0, lib_1.asyncHandler)(async (req, res) => {
    console.log(req.user);
    return res.out(req.user);
});
exports.logout = (0, lib_1.asyncHandler)(async (req, res) => {
    req.logout({ keepSessionInfo: false }, (err) => {
        if (err)
            throw new lib_1.AppError('Failed. Please try again.');
        return res.out({});
    });
});
