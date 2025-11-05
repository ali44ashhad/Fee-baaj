"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createImageEntry = void 0;
const uuid_1 = require("uuid");
/**
 * Generates a unique image ID for BunnyCDN.
 * Uses UUID to ensure uniqueness.
 */
const createImageEntry = (originalFilename) => {
    const extension = originalFilename.split(".").pop(); // Get file extension
    return `${(0, uuid_1.v4)()}.${extension}`; // Generate unique ID
};
exports.createImageEntry = createImageEntry;
