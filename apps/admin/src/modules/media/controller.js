"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.postMediaStatus = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const lib_1 = require("@elearning/lib");
const models_1 = require("@elearning/models");
/**
 * POST /api/media/hooks/status
 * Protected with ADMIN_API_KEY (bearer token).
 */
exports.postMediaStatus = (0, lib_1.asyncHandler)(async (req, res) => {
    // Basic auth check
    const auth = (req.headers.authorization || '').trim();
    if (!auth || !auth.startsWith('Bearer ')) {
        return res.status(401).json({ ok: false, message: 'Unauthorized' });
    }
    const token = auth.slice(7);
    if (token !== process.env.ADMIN_API_KEY) {
        return res.status(403).json({ ok: false, message: 'Forbidden' });
    }
    const { videoId, videoJobId, courseId: incomingCourseId, lectureId: incomingLectureId, step, pct, s3Prefix, playbackUrl, error, ...rest } = req.body || {};
    // Logging for debugging (can be reduced/removed in prod)
    console.log('[media/hooks] received payload:', { videoId, videoJobId, incomingCourseId, incomingLectureId, step, pct, s3Prefix, playbackUrl, error });
    // Prefer explicit courseId if provided. Fallback: if videoId looks like a Mongo ObjectId, use it.
    let courseId = null;
    if (incomingCourseId) {
        courseId = String(incomingCourseId);
    }
    else if (videoId && mongoose_1.default.isValidObjectId(String(videoId))) {
        courseId = String(videoId);
    }
    // Build a set of updates for videoStatus (only include fields that exist)
    const now = new Date();
    const makeVideoStatusSet = () => {
        const set = {};
        if (step !== undefined)
            set['videoStatus.step'] = step;
        if (typeof pct === 'number')
            set['videoStatus.pct'] = pct;
        if (s3Prefix !== undefined)
            set['videoStatus.s3Prefix'] = s3Prefix;
        if (playbackUrl !== undefined)
            set['videoStatus.playbackUrl'] = playbackUrl;
        if (error !== undefined)
            set['videoStatus.error'] = error;
        if (videoJobId !== undefined)
            set['videoStatus.videoJobId'] = videoJobId;
        if (videoId !== undefined)
            set['videoStatus.videoId'] = videoId;
        set['videoStatus.updatedAt'] = now;
        return set;
    };
    const videoStatusSet = makeVideoStatusSet();
    // Remove undefined keys (defensive)
    Object.keys(videoStatusSet).forEach((k) => {
        if (videoStatusSet[k] === undefined)
            delete videoStatusSet[k];
    });
    // Nothing to update?
    if (Object.keys(videoStatusSet).length === 0) {
        console.log('[media/hooks] nothing to update (no valid fields) payload:', req.body);
        return res.json({ ok: true, message: 'no update fields provided' });
    }
    // If lectureId provided and courseId known -> update nested lecture videoStatus
    if (incomingLectureId && courseId && mongoose_1.default.isValidObjectId(courseId)) {
        try {
            // Try to update the lecture in chapters collection: use positional $ operator
            // We need to match a chapter that contains the lecture (_id equals incomingLectureId) and the courseId
            const lectureObjectId = String(incomingLectureId);
            // Build $set object mapping to the positional lectures.$.videoStatus.* fields
            const setObj = {};
            for (const [k, v] of Object.entries(videoStatusSet)) {
                // videoStatusSet keys are like 'videoStatus.step' -> map to 'lectures.$.videoStatus.step'
                const suffix = k.replace(/^videoStatus\./, '');
                setObj[`lectures.$.videoStatus.${suffix}`] = v;
            }
            // Also set updatedAt explicitly (already included, but ensure it's under lectures.$)
            setObj['lectures.$.videoStatus.updatedAt'] = now;
            const query = { courseId: new mongoose_1.default.Types.ObjectId(courseId), 'lectures._id': new mongoose_1.default.Types.ObjectId(lectureObjectId) };
            const updated = await models_1.Chapter.findOneAndUpdate(query, { $set: setObj }, { new: true }).lean();
            if (!updated) {
                // Not found: maybe the lecture is saved as string IDs; fall back to searching without objectId conversion
                const fallbackQuery = { courseId: courseId, 'lectures._id': lectureObjectId };
                const updatedFallback = await models_1.Chapter.findOneAndUpdate(fallbackQuery, { $set: setObj }, { new: true }).lean();
                if (!updatedFallback) {
                    console.warn('[media/hooks] lecture not found to update', { courseId, lectureId: lectureObjectId });
                    // Still return 200 so worker doesn't treat as error (but warn)
                    return res.status(200).json({ ok: true, message: 'lecture not found; logged' });
                }
                else {
                    console.log('[media/hooks] updated lecture videoStatus (fallback query)', { courseId, lectureId: lectureObjectId });
                    return res.json({ ok: true, chapter: updatedFallback });
                }
            }
            console.log('[media/hooks] updated lecture videoStatus', { courseId, lectureId: lectureObjectId, step });
            return res.json({ ok: true, chapter: updated });
        }
        catch (err) {
            console.error('[media/hooks] error updating lecture videoStatus', err);
            return res.status(500).json({ ok: false, message: err.message || 'Internal error' });
        }
    }
    // Otherwise, if we have a valid courseId -> update Course.videoStatus
    if (courseId && mongoose_1.default.isValidObjectId(courseId)) {
        try {
            const course = await models_1.Course.findByIdAndUpdate(courseId, { $set: videoStatusSet }, { new: true }).lean();
            if (!course) {
                console.warn('[media/hooks] course not found for id', courseId, 'payload:', req.body);
                return res.status(404).json({ ok: false, message: 'Course not found' });
            }
            console.log('[media/hooks] updated course videoStatus', { courseId, step, pct, s3Prefix, playbackUrl });
            return res.json({ ok: true, course });
        }
        catch (err) {
            console.error('[media/hooks] error updating course', err);
            return res.status(500).json({ ok: false, message: err.message || 'Internal error' });
        }
    }
    // No valid course id provided — don't try to update DB.
    console.log('[media/hooks] no valid courseId provided, ignoring DB update. payload:', req.body);
    return res.json({ ok: true, message: 'no courseId provided; status logged' });
});
