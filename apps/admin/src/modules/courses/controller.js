"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.remove = exports.list = exports.read = exports.update = exports.create = void 0;
const fetcher_1 = require("../../lib/fetcher");
const mainController_1 = require("@/lib/mainController");
const lib_1 = require("@elearning/lib");
const models_1 = require("@elearning/models");
const src_1 = require("@/../../../packages/types/src");
const generateUniqueSlug_1 = __importDefault(require("../../helper/generateUniqueSlug"));
const promises_1 = __importDefault(require("fs/promises"));
const path_1 = __importDefault(require("path"));
const uploadService_1 = require("../../helper/uploadService");
const createImageEntry_1 = require("../../helper/createImageEntry");
const parseCoursePayload = async (req, isUpdate = false) => {
    const { title, slug, subtitle, description, price, originalPrice, categoryId, instructorId, objectives, requirements, bestSeller, premium, published, videoPopups, display, } = req.body;
    const files = req.files;
    const videoFile = files?.video?.[0];
    const thumbnailFile = files?.thumbnail?.[0];
    if (title == null ||
        price == null ||
        instructorId == null ||
        categoryId == null ||
        display == null) {
        throw new Error('Missing required fields.');
    }
    const numericPrice = parseFloat(price);
    if (isNaN(numericPrice) || numericPrice < 0) {
        throw new Error('Invalid price value.');
    }
    const parsedObjectives = Array.isArray(objectives) ? objectives : [objectives];
    const parsedRequirements = Array.isArray(requirements) ? requirements : [requirements];
    let parsedDisplay;
    try {
        parsedDisplay = typeof display === 'string' ? JSON.parse(display) : display;
    }
    catch {
        throw new Error('Invalid display object.');
    }
    let parsedVideoPopups = [];
    try {
        parsedVideoPopups = typeof videoPopups === 'string' ? JSON.parse(videoPopups) : videoPopups;
        if (!Array.isArray(parsedVideoPopups))
            parsedVideoPopups = [parsedVideoPopups];
    }
    catch {
        parsedVideoPopups = [];
    }
    const payload = {
        title,
        slug, // <-- allow optional slug override
        subtitle,
        description,
        price: numericPrice,
        originalPrice,
        categoryId,
        instructorId,
        objectives: parsedObjectives,
        requirements: parsedRequirements,
        bestSeller: bestSeller === 'true' || bestSeller === true,
        premium: premium === 'true' || premium === true,
        published: published === 'true' || published === true,
        videoPopups: parsedVideoPopups,
        display: parsedDisplay,
    };
    return { payload, videoFile, thumbnailFile };
};
const mapLecturesWithPreview = async (lectures) => {
    return Promise.all(lectures.map(async (lec) => {
        const lecture = { ...lec };
        if (typeof lec.video === 'string' && lec.video.trim() !== '') {
            try {
                lecture.previewUrl = await (0, uploadService_1.getBunnyPreviewUrl)(lec.video);
            }
            catch (err) {
                console.error(`Failed to fetch Bunny preview for ${lec.video}:`, err);
            }
        }
        return lecture;
    }));
};
const handleFileUploads = async (videoFile, thumbnailFile, title) => {
    let videoId = '';
    let thumbnailUrl = '';
    if (videoFile && title) {
        videoId = await (0, uploadService_1.uploadVideoProcess)(videoFile.path, title);
    }
    if (thumbnailFile) {
        const imageId = await (0, createImageEntry_1.createImageEntry)(path_1.default.basename(thumbnailFile.path));
        const uploadSuccess = await (0, uploadService_1.uploadImageToBunny)(thumbnailFile.path, imageId);
        if (!uploadSuccess)
            throw new Error('Thumbnail upload failed.');
        thumbnailUrl = `https://ThumNailfreebajPull.b-cdn.net/${imageId}`;
    }
    return { videoId, thumbnailUrl };
};
// CREATE COURSE
exports.create = (0, lib_1.asyncHandler)(async (req, res) => {
    let videoFile;
    let thumbnailFile;
    try {
        const { payload, videoFile: vFile, thumbnailFile: tFile } = await parseCoursePayload(req);
        videoFile = vFile;
        thumbnailFile = tFile;
        const { videoId, thumbnailUrl } = await handleFileUploads(videoFile, thumbnailFile, payload.title);
        if (videoId)
            payload.bunnyVideoId = videoId;
        if (thumbnailUrl) {
            payload.thumbnailUrl = thumbnailUrl;
            payload.thumbnailId = thumbnailUrl.split('/').pop();
        }
        // generate slug from title
        payload.slug = await (0, generateUniqueSlug_1.default)(payload.title);
        const course = await models_1.Course.create(payload);
        return res.status(201).json({ success: true, message: 'Created', _id: course._id });
    }
    catch (error) {
        console.error("Unexpected error:", error);
        return res.status(500).json({ success: false, message: error.message || 'Internal Server Error' });
    }
    finally {
        if (videoFile)
            await promises_1.default.unlink(videoFile.path).catch(() => null);
        if (thumbnailFile)
            await promises_1.default.unlink(thumbnailFile.path).catch(() => null);
    }
});
// UPDATE COURSE
exports.update = (0, lib_1.asyncHandler)(async (req, res) => {
    let videoFile;
    let thumbnailFile;
    try {
        const course = await models_1.Course.findById(req.params.id);
        if (!course) {
            return res.status(404).json({ success: false, message: 'Course not found' });
        }
        const oldVideoId = course.bunnyVideoId;
        const oldThumbnailUrl = course.thumbnailUrl;
        const { payload, videoFile: vFile, thumbnailFile: tFile } = await parseCoursePayload(req, true);
        videoFile = vFile;
        thumbnailFile = tFile;
        const { videoId, thumbnailUrl } = await handleFileUploads(videoFile, thumbnailFile, payload.title);
        if (videoId) {
            if (oldVideoId)
                await (0, uploadService_1.deleteVideoFromBunny)(oldVideoId).catch(console.error);
            payload.bunnyVideoId = videoId;
        }
        if (thumbnailUrl) {
            const oldImageName = typeof oldThumbnailUrl === 'string'
                ? oldThumbnailUrl.split('/').pop()
                : null;
            if (oldImageName)
                await (0, uploadService_1.deleteImageFromBunny)(oldImageName).catch(console.error);
            payload.thumbnailUrl = thumbnailUrl;
            payload.thumbnailId = thumbnailUrl.split('/').pop();
        }
        // slug override: if admin provided one, generate & ensure uniqueness;
        // otherwise keep existing slug
        if (payload.slug && payload.slug.trim() !== '') {
            payload.slug = await (0, generateUniqueSlug_1.default)(payload.slug, course._id.toString());
        }
        else {
            payload.slug = course.slug;
        }
        Object.assign(course, payload);
        await course.save();
        return res.status(200).json({ success: true, message: 'Updated', _id: course._id });
    }
    catch (error) {
        console.error("Unexpected error:", error);
        return res.status(500).json({ success: false, message: error.message || 'Internal Server Error' });
    }
    finally {
        if (videoFile)
            await promises_1.default.unlink(videoFile.path).catch(() => null);
        if (thumbnailFile)
            await promises_1.default.unlink(thumbnailFile.path).catch(() => null);
    }
});
// GET SINGLE COURSE + CHAPTERS + VIDEO LENGTH
exports.read = (0, lib_1.asyncHandler)(async (req, res) => {
    mainController_1.mainController.read(req, res, models_1.Course, async (course) => {
        const chapters = await models_1.Chapter.find({ courseId: course._id }).lean();
        const chaptersWithLectures = await Promise.all(chapters.map(async (chapter) => ({
            ...chapter,
            lectures: await mapLecturesWithPreview(chapter.lectures || []),
        })));
        let videoLength = null;
        if (course.bunnyVideoId) {
            try {
                videoLength = await (0, uploadService_1.getBunnyVideoLength)(course.bunnyVideoId);
            }
            catch (error) {
                console.error("Error fetching video length:", error);
            }
        }
        return res.out({
            ...course.toObject(),
            chapters: chaptersWithLectures,
            videoLength,
        });
    });
});
// ADMIN: LIST COURSES with optional published filter + search + pagination
exports.list = (0, lib_1.asyncHandler)(async (req, res) => {
    // parse query params
    const page = req.query.page && typeof req.query.page === 'string' ? parseInt(req.query.page) : 1;
    const limit = req.query.limit && typeof req.query.limit === 'string' ? parseInt(req.query.limit) : 10;
    const sort = req.query.sort || -1;
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
    const publishedRaw = typeof req.query.published === 'string' ? req.query.published : undefined;
    const filter = {};
    // search by title or slug if provided
    if (search) {
        filter.$or = [
            { title: { $regex: search, $options: 'i' } },
            { slug: { $regex: search, $options: 'i' } },
        ];
    }
    // published filter: 'true' or 'false' (string)
    if (publishedRaw === 'true')
        filter.published = true;
    else if (publishedRaw === 'false')
        filter.published = false;
    // otherwise undefined => return both published & drafts
    const count = await models_1.Course.countDocuments(filter);
    if (count === 0) {
        return res.out({
            count: 0,
            total: 0,
            perPage: limit,
            currentPage: page,
            data: [],
        }, src_1.STATUS_MESSAGES.NO_DATA);
    }
    const skip = page > 1 ? (page - 1) * limit : 0;
    const courses = await models_1.Course.find(filter)
        .sort({ createdAt: sort })
        .limit(limit)
        .skip(skip)
        .populate('instructor', 'name pictureId pictureUrl profession description')
        .lean();
    // you'll likely want to return raw course objects for admin (no extra enrichment)
    const out = {
        total: count,
        count: courses.length,
        perPage: limit,
        currentPage: page,
        data: courses,
    };
    return res.out(out);
});
// DELETE COURSE
// in your admin controllers file (e.g. controllers/course.ts) — replace/export remove
// optional: if your node version doesn't have global fetch
// ...other imports remain the same
exports.remove = (0, lib_1.asyncHandler)(async (req, res) => {
    const course = await models_1.Course.findById(req.params.id);
    if (!course) {
        res.status(404);
        throw new Error('Course not found');
    }
    // 1) Ask media-server to delete course media (all lecture + intro)
    try {
        const mediaUrlBase = process.env.MEDIA_API_URL || process.env.MEDIA_SERVER_URL || '';
        if (mediaUrlBase) {
            const mediaDeleteUrl = `${mediaUrlBase.replace(/\/$/, '')}/api/media/delete`;
            const authHeader = `Bearer ${process.env.ADMIN_API_KEY || ''}`;
            const body = { type: 'course', courseId: String(course._id) };
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
                console.log('[course.remove] media-delete response', { status: resp.status, body: json });
            }
            catch (err) {
                // non-fatal: log and continue (we still delete DB record)
                console.warn('[course.remove] media-delete request failed (non-fatal):', err?.message || err);
            }
        }
        else {
            console.warn('[course.remove] MEDIA_API_URL not configured — skipping media-delete call');
        }
    }
    catch (e) {
        console.warn('[course.remove] media-delete flow error (non-fatal):', e?.message || e);
    }
    // 3) delete DB record and respond
    await course.deleteOne();
    res.json({ message: 'Course and related assets deleted' });
});
