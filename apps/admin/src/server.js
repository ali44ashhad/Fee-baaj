"use strict";
/* eslint-disable no-console */
/* eslint-disable no-process-exit */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const app_1 = __importDefault(require("./app"));
const config_1 = __importDefault(require("./config"));
const mongoose_1 = __importDefault(require("mongoose"));
// Handle uncaught exceptions. Happens synchronously!
process.on("uncaughtException", (err) => {
    console.log("Unhandled exception 💥! Application shutting down!");
    console.log(err.name, err.message);
    process.exit(1);
});
const PORT = config_1.default.api.port || 5000;
const DB = config_1.default.db.url || "";
mongoose_1.default
    .connect(DB, {
    dbName: config_1.default.db.name,
})
    .then(() => {
    console.log("MongoDB connection successfull! 🔥");
})
    .catch((err) => {
    console.log(`Error found! Error: ${err}`);
});
const server = app_1.default.listen(PORT, () => {
    console.log(`Application running on Express.js on port ${PORT}! 👍`);
});
// Handle unhandled rejections --- the middleware stack will end here.
process.on("unhandledRejection", (err) => {
    console.log("Unhandled rejection 💥! Application shutting down!");
    console.log(err.name, err.message);
    // Finish all requests that are still pending, the shutdown gracefully.
    server.close(() => {
        process.exit(1);
    });
});
