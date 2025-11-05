"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const passport_1 = __importDefault(require("passport"));
const passport_local_1 = require("passport-local");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const models_1 = require("@elearning/models");
passport_1.default.serializeUser((user, done) => {
    done(null, user.id);
});
passport_1.default.deserializeUser(async (id, done) => {
    const admin = await models_1.Admin.findById(id);
    done(null, admin);
});
passport_1.default.use(new passport_local_1.Strategy({ usernameField: 'email' }, async (email, password, done) => {
    try {
        const admin = await models_1.Admin.findOne({ email });
        if (!admin)
            return done(null, false, { message: 'Admin not found' });
        const isMatch = await bcryptjs_1.default.compare(password, admin.password);
        if (!isMatch)
            return done(null, false, { message: 'Incorrect password' });
        return done(null, admin);
    }
    catch (error) {
        return done(error);
    }
}));
exports.default = passport_1.default;
