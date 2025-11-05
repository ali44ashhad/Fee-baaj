"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.removeLecture = exports.updateLecture = exports.addLecture = exports.remove = exports.list = exports.read = exports.update = exports.create = void 0;
const fetcher_1 = require("../../lib/fetcher");
const mongoose_1 = __importDefault(require("mongoose"));
const mainController_1 = require("@/lib/mainController");
const lib_1 = require("@elearning/lib");
const models_1 = require("@elearning/models");
const types_1 = require("@elearning/types");
const uploadService_1 = require("../../helper/uploadService");
const promises_1 = __importDefault(require("fs/promises"));
exports.create = (0, lib_1.asyncHandler)(async (req, res) => {
    mainController_1.mainController.create(req, res, models_1.Chapter);
});
exports.update = (0, lib_1.asyncHandler)(async (req, res) => {
    mainController_1.mainController.update(req, res, models_1.Chapter);
});
exports.read = (0, lib_1.asyncHandler)(async (req, res) => {
    mainController_1.mainController.read(req, res, models_1.Chapter);
});
exports.list = (0, lib_1.asyncHandler)(async (req, res) => {
    mainController_1.mainController.list(req, res, models_1.Chapter);
});
exports.remove = (0, lib_1.asyncHandler)(async (req, res) => {
    mainController_1.mainController.remove(req, res, models_1.Chapter);
});
exports.addLecture = (0, lib_1.asyncHandler)(async (req, res) => {
    const chapter = await models_1.Chapter.findById(req.params.id);
    if (!chapter) {
        throw new lib_1.AppError('chapter not found.', types_1.STATUS_MESSAGES.NOT_FOUND);
    }
    chapter.lectures.push(req.body);
    await chapter.save();
    const savedLecture = chapter.lectures[chapter.lectures.length - 1];
    return res.out({ message: 'Added.', lecture: savedLecture }, types_1.STATUS_MESSAGES.CREATED);
});
exports.updateLecture = (0, lib_1.asyncHandler)(async (req, res) => {
    const { id: chapterId, lectureId } = req.params;
    const chapter = await models_1.Chapter.findById(chapterId);
    if (!chapter)
        throw new lib_1.AppError('Chapter not found.', types_1.STATUS_MESSAGES.NOT_FOUND);
    const idx = chapter.lectures.findIndex((l) => l._id.toString() === lectureId);
    if (idx === -1)
        throw new lib_1.AppError('Lecture not found.', types_1.STATUS_MESSAGES.NOT_FOUND);
    const lecture = chapter.lectures[idx];
    const { title, videoPopups, duration } = req.body;
    const parsedPopups = videoPopups ?? lecture.videoPopups ?? [];
    // ✅ Make sure to safely cast Multer files
    const files = req.files;
    const videoFile = files?.video?.[0];
    let newVideoId = lecture.video;
    if (videoFile) {
        try {
            newVideoId = await (0, uploadService_1.uploadVideoProcess)(videoFile.path, title || lecture.title);
            if (lecture.video) {
                await (0, uploadService_1.deleteVideoFromBunny)(lecture.video);
            }
        }
        finally {
            // ✅ Always clean up temp file (important in production)
            await promises_1.default.unlink(videoFile.path).catch(() => null);
        }
    }
    lecture.title = title ?? lecture.title;
    lecture.video = newVideoId;
    lecture.duration = duration;
    lecture.videoPopups = parsedPopups;
    await chapter.save();
    return res.out({ message: 'Lecture updated.', lecture }, types_1.STATUS_MESSAGES.UPDATED);
});
exports.removeLecture = (0, lib_1.asyncHandler)(async (req, res) => {
    // expects: req.params.id => chapterId, req.params.lectureId => lectureId
    const chapterId = req.params.id;
    const lectureId = req.params.lectureId;
    if (!chapterId || !lectureId) {
        return res.status(400).json({ success: false, message: 'chapter id and lecture id required' });
    }
    // load chapter so we can get courseId (needed to instruct media server)
    const chapter = await models_1.Chapter.findById(chapterId);
    if (!chapter) {
        return res.status(404).json({ success: false, message: 'Chapter not found' });
    }
    // find lecture and optionally its video key/id for logging
    const lecture = (chapter.lectures || []).find((l) => String(l._id) === String(lectureId) || String(l.id) === String(lectureId));
    if (!lecture) {
        return res.status(404).json({ success: false, message: 'Lecture not found in chapter' });
    }
    // 1) Ask media-server to delete lecture media
    try {
        const mediaUrlBase = process.env.MEDIA_API_URL || process.env.MEDIA_SERVER_URL || '';
        if (mediaUrlBase) {
            const mediaDeleteUrl = `${mediaUrlBase.replace(/\/$/, '')}/api/media/delete`;
            const authHeader = `Bearer ${process.env.ADMIN_API_KEY || ''}`;
            const body = { type: 'lecture', courseId: String(chapter.courseId), lectureId: String(lecture._id) };
            try {
                const resp = await (0, fetcher_1.fetcher)(mediaDeleteUrl, {
                    method: 'POST',
                    headers: {
                        'content-type': 'application/json',
                        Authorization: authHeader,
                    },
                    body: JSON.stringify(body),
                });
                const json = await resp.json().catch(() => ({}));
                console.log('[chapter.removeLecture] media-delete response', { status: resp.status, body: json });
            }
            catch (err) {
                console.warn('[chapter.removeLecture] media-delete request failed (non-fatal):', err?.message || err);
            }
        }
        else {
            console.warn('[chapter.removeLecture] MEDIA_API_URL not configured — skipping media-delete call');
        }
    }
    catch (e) {
        console.warn('[chapter.removeLecture] media-delete flow error (non-fatal):', e?.message || e);
    }
    // 2) Remove lecture from chapter document (atomic update)
    try {
        const result = await models_1.Chapter.findByIdAndUpdate(chapterId, { $pull: { lectures: { _id: new mongoose_1.default.Types.ObjectId(lectureId) } } }, { new: true }).lean();
        if (!result) {
            return res.status(404).json({ success: false, message: 'Failed removing lecture' });
        }
        // return the updated chapter (or simple success message)
        return res.json({ success: true, message: 'Lecture deleted', chapter: result });
    }
    catch (err) {
        console.error('[chapter.removeLecture] DB error:', err);
        return res.status(500).json({ success: false, message: err.message || 'Internal Server Error' });
    }
});
