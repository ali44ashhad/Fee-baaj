"use strict";
// Assuming this is the content of your admin API route file (e.g., admin-uploads-webhook.ts)
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const crypto_1 = __importDefault(require("crypto"));
const models_1 = require("@elearning/models");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const router = express_1.default.Router();
function verifySignature(bodyRaw, header) {
    const secret = process.env.WEBHOOK_SECRET || "";
    if (!header || !secret)
        return false;
    const provided = String(header).replace(/^sha256=/i, "");
    const expected = crypto_1.default.createHmac("sha256", secret).update(bodyRaw).digest("hex");
    try {
        return crypto_1.default.timingSafeEqual(Buffer.from(expected), Buffer.from(provided));
    }
    catch (e) {
        return false;
    }
}
/**
 * POST /internal/uploads/complete (EXISTING ROUTE)
 * ... (existing implementation for upload complete) ...
 */
router.post("/uploads/complete", express_1.default.json({ limit: "64kb" }), async (req, res) => {
    const raw = JSON.stringify(req.body || {});
    const sig = req.headers["x-webhook-signature"];
    if (!verifySignature(raw, sig)) {
        res.status(401).json({ ok: false, error: "invalid signature" });
        return;
    }
    const { targetType, targetId, key, url, // optional: direct CDN URL provided by media server
    variants, meta, uploadedAt, } = req.body;
    if (!targetType || !targetId || !key) {
        res.status(400).json({ ok: false, error: "missing fields" });
        return;
    }
    // Determine pictureUrl:
    let pictureUrl;
    if (url && typeof url === "string" && url.trim() !== "") {
        pictureUrl = url;
    }
    else if (process.env.S3_CDN_URL && String(process.env.S3_CDN_URL).trim() !== "") {
        const cdn = String(process.env.S3_CDN_URL).trim().replace(/\/$/, "");
        pictureUrl = `${cdn}/${key}`.replace(/([^:]\/)\/+/g, "$1");
    }
    else {
        const mediaBase = process.env.MEDIA_BASE_URL || "";
        pictureUrl = mediaBase
            ? `${mediaBase.replace(/\/$/, "")}/media/image?key=${encodeURIComponent(key)}`
            : key;
    }
    try {
        const updateObj = { updatedAt: new Date() };
        // Branch by targetType
        if (targetType === "users") {
            updateObj.pictureId = key;
            updateObj.pictureUrl = pictureUrl;
            await models_1.User.findByIdAndUpdate(targetId, { $set: updateObj }, { new: true }).exec();
        }
        else if (targetType === "instructors") {
            updateObj.pictureId = key;
            updateObj.pictureUrl = pictureUrl;
            await models_1.Instructor.findByIdAndUpdate(targetId, { $set: updateObj }, { new: true }).exec();
        }
        else if (targetType === "courses") {
            // store thumbnailId and thumbnailUrl on the Course model
            updateObj.thumbnailId = key;
            updateObj.thumbnailUrl = pictureUrl;
            await models_1.Course.findByIdAndUpdate(targetId, { $set: updateObj }, { new: true }).exec();
        }
        else {
            res.status(400).json({ ok: false, error: "unknown targetType" });
            return;
        }
        res.json({ ok: true });
        return;
    }
    catch (err) {
        console.error("db update error:", err && err.message);
        res.status(500).json({ ok: false, error: "db update failed" });
        return;
    }
});
/**
 * POST /internal/images/deleted
 * body: { targetType, targetId, deletedAt }
 *
 * Behavior:
 *  - Clears the relevant picture/thumbnail fields on the model when an image prefix is deleted.
 */
router.post("/images/deleted", express_1.default.json({ limit: "64kb" }), async (req, res) => {
    const raw = JSON.stringify(req.body || {});
    const sig = req.headers["x-webhook-signature"];
    if (!verifySignature(raw, sig)) {
        res.status(401).json({ ok: false, error: "invalid signature" });
        return;
    }
    const { targetType, targetId } = req.body;
    if (!targetType || !targetId) {
        res.status(400).json({ ok: false, error: "missing targetType or targetId" });
        return;
    }
    try {
        let updateFields;
        let Model;
        // Determine model and fields to clear based on targetType
        if (targetType === "users") {
            Model = models_1.User;
            updateFields = { pictureId: null, pictureUrl: null };
        }
        else if (targetType === "instructors") {
            Model = models_1.Instructor;
            updateFields = { pictureId: null, pictureUrl: null };
        }
        else if (targetType === "courses") {
            Model = models_1.Course;
            updateFields = { thumbnailId: null, thumbnailUrl: null };
        }
        else {
            res.status(400).json({ ok: false, error: "unknown targetType" });
            return;
        }
        // Update the document to clear the image/thumbnail fields
        const result = await Model.findByIdAndUpdate(targetId, { $set: { ...updateFields, updatedAt: new Date() } }, { new: false } // We don't need the updated document back
        ).exec();
        if (!result) {
            console.warn(`images/deleted webhook: No ${targetType} found with ID ${targetId}`);
            // Still return 200/ok so media server doesn't keep retrying.
            res.status(200).json({ ok: true, message: 'target not found, but acknowledged' });
            return;
        }
        console.log(`Successfully cleared ${targetType} image fields for ID ${targetId}`);
        res.json({ ok: true });
        return;
    }
    catch (err) {
        console.error("images/deleted db update error:", err && err.message);
        res.status(500).json({ ok: false, error: "db update failed" });
        return;
    }
});
exports.default = router;
