"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.reportMessage = exports.getMessageById = exports.postInstructorMessage = exports.getInstructorMessagesAround = exports.getInstructorMessages = exports.getUserConversationsForInstructor = void 0;
const lib_1 = require("@elearning/lib");
const models_1 = require("@elearning/models");
const mongoose_1 = __importStar(require("mongoose"));
const types_1 = require("@elearning/types");
/**
 * GET /chat/instructor/:insId/messages/summary
 * List student threads for this instructor
 */
exports.getUserConversationsForInstructor = (0, lib_1.asyncHandler)(async (req, res) => {
    const insId = req.params.insId;
    if (!(0, mongoose_1.isValidObjectId)(insId)) {
        throw new lib_1.AppError('Invalid instructor ID', types_1.STATUS_MESSAGES.NO_DATA);
    }
    const insObjId = new mongoose_1.default.Types.ObjectId(insId);
    // 1) Latest per student
    const latest = await models_1.Message.aggregate([
        { $match: {
                $or: [
                    { 'sender.id': insObjId, 'sender.model': 'Instructor' },
                    { 'receiver.id': insObjId, 'receiver.model': 'Instructor' }
                ]
            }
        },
        { $sort: { createdAt: -1 } },
        { $group: {
                _id: {
                    userId: {
                        $cond: [
                            { $eq: ['$sender.model', 'User'] }, '$sender.id', '$receiver.id'
                        ]
                    }
                },
                lastMessage: { $first: '$content' },
                lastMessageAt: { $first: '$createdAt' }
            } }
    ]);
    const studentIds = latest.map(x => x._id.userId);
    // 2) Unread counts
    const unread = await models_1.Message.aggregate([
        { $match: {
                'receiver.id': insObjId,
                'receiver.model': 'Instructor',
                'sender.model': 'User',
                'sender.id': { $in: studentIds },
                'seenBy.id': { $ne: insObjId }
            }
        },
        { $group: { _id: '$sender.id', count: { $sum: 1 } } }
    ]);
    const unreadMap = unread.reduce((m, x) => {
        m[x._id.toString()] = x.count;
        return m;
    }, {});
    // 3) Load student profiles
    const students = await models_1.User.find({ _id: { $in: studentIds } })
        .select('name pictureUrl isVerified')
        .lean();
    const studentMap = Object.fromEntries(students.map(u => [u._id.toString(), u]));
    // 4) Build response
    const conversations = latest.map(item => {
        const uid = item._id.userId.toString();
        const usr = studentMap[uid];
        if (!usr)
            return null;
        return {
            userId: uid,
            name: usr.name,
            pictureUrl: usr.pictureUrl || null,
            isVerified: usr.isVerified,
            lastMessage: item.lastMessage,
            lastMessageAt: item.lastMessageAt,
            unreadCount: unreadMap[uid] || 0
        };
    }).filter(Boolean);
    return res.out({ conversations });
});
/**
 * GET /chat/instructor/student/:studentId/messages
 * Fetch 1:1 thread between the authenticated instructor and a student
 */
exports.getInstructorMessages = (0, lib_1.asyncHandler)(async (req, res) => {
    const instructorId = req.params.insId; // Authenticated instructor
    const studentId = req.params.userId; // Student ID from params
    if (!(0, mongoose_1.isValidObjectId)(studentId)) {
        throw new lib_1.AppError('Invalid student ID', types_1.STATUS_MESSAGES.NO_DATA);
    }
    if (!(0, mongoose_1.isValidObjectId)(instructorId)) {
        throw new lib_1.AppError('Invalid instructor ID', types_1.STATUS_MESSAGES.NO_DATA);
    }
    const MAX_LIMIT = 100;
    const DEFAULT_LIMIT = 20;
    // Parse limit
    let limit = Number(req.query.limit) || DEFAULT_LIMIT;
    if (limit <= 0)
        limit = DEFAULT_LIMIT;
    limit = Math.min(limit, MAX_LIMIT);
    // We fetch limit + 1 to know whether there are older messages
    const fetchLimit = limit + 1;
    // Parse "before" for pagination
    const beforeRaw = req.query.before || undefined;
    let beforeDate;
    if (beforeRaw) {
        const d = new Date(beforeRaw);
        if (!isNaN(d.getTime())) {
            beforeDate = d;
        }
        else {
            throw new lib_1.AppError('Invalid "before" timestamp', types_1.STATUS_MESSAGES.NO_DATA);
        }
    }
    // Build filter for messages between instructor and student
    const baseFilter = {
        $or: [
            {
                'sender.id': instructorId,
                'sender.model': 'Instructor',
                'receiver.id': studentId,
                'receiver.model': 'User',
            },
            {
                'sender.id': studentId,
                'sender.model': 'User',
                'receiver.id': instructorId,
                'receiver.model': 'Instructor',
            },
        ],
    };
    if (beforeDate) {
        baseFilter.createdAt = { $lt: beforeDate };
    }
    // Query newest-first for efficient limit, then trim and reverse before returning
    let query = models_1.Message.find(baseFilter).sort({ createdAt: -1 }).limit(fetchLimit);
    // Populate replyTo with compact snippet for client rendering
    query = query.populate({
        path: 'replyTo',
        select: 'content sender createdAt',
    });
    const found = await query.lean().exec();
    let hasMore = false;
    let results = found;
    if (found.length > limit) {
        hasMore = true;
        results = found.slice(0, limit);
    }
    // Reverse to ascending order (older -> newer) for natural display order on client
    results = results.reverse();
    return res.out({ messages: results, hasMore });
});
exports.getInstructorMessagesAround = (0, lib_1.asyncHandler)(async (req, res) => {
    const instructorId = req.params.instructorId; // Authenticated instructor
    const studentId = req.params.studentId; // Student ID from params
    const aroundId = req.params.aroundId || req.query.around;
    if (!(0, mongoose_1.isValidObjectId)(studentId)) {
        throw new lib_1.AppError('Invalid student ID', types_1.STATUS_MESSAGES.NO_DATA);
    }
    if (!aroundId || !(0, mongoose_1.isValidObjectId)(aroundId)) {
        throw new lib_1.AppError('Invalid around message id', types_1.STATUS_MESSAGES.NO_DATA);
    }
    const MAX_LIMIT = 200;
    const DEFAULT_LIMIT = 40;
    let limit = Number(req.query.limit) || DEFAULT_LIMIT;
    if (limit <= 0)
        limit = DEFAULT_LIMIT;
    limit = Math.min(limit, MAX_LIMIT);
    // Find the target message first (ensure it belongs to the conversation)
    const pivot = await models_1.Message.findById(aroundId).lean();
    if (!pivot) {
        throw new lib_1.AppError('Target message not found', types_1.STATUS_MESSAGES.NOT_FOUND);
    }
    // Ensure pivot belongs to the conversation between instructor & student
    const participants = [
        String(pivot.sender?.id ?? ''),
        String(pivot.receiver?.id ?? ''),
    ];
    if (!participants.includes(String(instructorId)) && !participants.includes(String(studentId))) {
        throw new lib_1.AppError('Target message is not part of this conversation', types_1.STATUS_MESSAGES.NO_DATA);
    }
    // We will fetch up to half before, half after (plus pivot)
    const half = Math.floor(limit / 2);
    // Base conversation filter
    const baseFilter = {
        $or: [
            {
                'sender.id': instructorId,
                'sender.model': 'Instructor',
                'receiver.id': studentId,
                'receiver.model': 'User',
            },
            {
                'sender.id': studentId,
                'sender.model': 'User',
                'receiver.id': instructorId,
                'receiver.model': 'Instructor',
            },
        ],
    };
    // --- older (before pivot.createdAt) ---
    const beforeQuery = models_1.Message.find({
        ...baseFilter,
        $or: [
            // created earlier than pivot
            { createdAt: { $lt: pivot.createdAt } },
            // created at same timestamp but _id < pivot._id as deterministic tie-breaker
            { createdAt: pivot.createdAt, _id: { $lt: pivot._id } },
        ],
    })
        .sort({ createdAt: -1, _id: -1 })
        .limit(half)
        .populate({ path: 'replyTo', select: 'content sender createdAt' })
        .lean();
    // --- after (strictly newer than pivot.createdAt) ---
    const afterQuery = models_1.Message.find({
        ...baseFilter,
        $or: [
            { createdAt: { $gt: pivot.createdAt } },
            { createdAt: pivot.createdAt, _id: { $gt: pivot._id } },
        ],
    })
        .sort({ createdAt: 1, _id: 1 })
        .limit(limit - half - 1) // minus pivot
        .populate({ path: 'replyTo', select: 'content sender createdAt' })
        .lean();
    // Fetch both
    const [beforeDocs, afterDocs] = await Promise.all([beforeQuery.exec(), afterQuery.exec()]);
    // Determine if there are more messages beyond the slices
    let hasMoreBefore = false;
    if (beforeDocs.length > 0) {
        const lastBefore = beforeDocs[beforeDocs.length - 1];
        const countOlder = await models_1.Message.countDocuments({
            ...baseFilter,
            $or: [
                { createdAt: { $lt: lastBefore.createdAt } },
                { createdAt: lastBefore.createdAt, _id: { $lt: lastBefore._id } },
            ],
        }).exec();
        hasMoreBefore = countOlder > 0;
    }
    else {
        // if no beforeDocs, pivot might be earliest chunk; check if any older than pivot
        const countOlder = await models_1.Message.countDocuments({
            ...baseFilter,
            $or: [{ createdAt: { $lt: pivot.createdAt } }, { createdAt: pivot.createdAt, _id: { $lt: pivot._id } }],
        }).exec();
        hasMoreBefore = countOlder > 0;
    }
    let hasMoreAfter = false;
    if (afterDocs.length > 0) {
        const lastAfter = afterDocs[afterDocs.length - 1];
        const countNewer = await models_1.Message.countDocuments({
            ...baseFilter,
            $or: [{ createdAt: { $gt: lastAfter.createdAt } }, { createdAt: lastAfter.createdAt, _id: { $gt: lastAfter._id } }],
        }).exec();
        hasMoreAfter = countNewer > 0;
    }
    else {
        // if no afterDocs, check if there are messages newer than pivot
        const countNewer = await models_1.Message.countDocuments({
            ...baseFilter,
            $or: [{ createdAt: { $gt: pivot.createdAt } }, { createdAt: pivot.createdAt, _id: { $gt: pivot._id } }],
        }).exec();
        hasMoreAfter = countNewer > 0;
    }
    // Build chronological results: older (reverse the desc list) + pivot + after (already asc)
    const olderChron = (beforeDocs || []).slice().reverse();
    const pivotPopulated = await models_1.Message.findById(pivot._id)
        .populate({ path: 'replyTo', select: 'content sender createdAt' })
        .lean();
    const messages = [...olderChron, pivotPopulated, ...(afterDocs || [])].filter(Boolean);
    return res.out({ messages, hasMoreBefore, hasMoreAfter });
});
/**
 * POST /chat/instructor/student/:studentId/message
 * Instructor → student message
 */
exports.postInstructorMessage = (0, lib_1.asyncHandler)(async (req, res) => {
    const instructorId = req.user._id; // Authenticated instructor
    const studentId = req.params.studentId;
    const { content, replyTo } = req.body;
    if (!(0, mongoose_1.isValidObjectId)(studentId)) {
        throw new lib_1.AppError('Invalid student ID', types_1.STATUS_MESSAGES.NOT_FOUND);
    }
    if (typeof content !== 'string' || !content.trim()) {
        throw new lib_1.AppError('Message content is required', types_1.STATUS_MESSAGES.NO_DATA);
    }
    const sender = {
        id: instructorId,
        model: 'Instructor',
    };
    const receiver = {
        id: new mongoose_1.Types.ObjectId(studentId),
        model: 'User',
    };
    // Validate replyTo if provided
    let replyToObjId = null;
    if (replyTo) {
        if (!(0, mongoose_1.isValidObjectId)(replyTo)) {
            throw new lib_1.AppError('Invalid replyTo id', types_1.STATUS_MESSAGES.NO_DATA);
        }
        replyToObjId = new mongoose_1.Types.ObjectId(replyTo);
        const repliedMsg = await models_1.Message.findById(replyToObjId).lean();
        if (!repliedMsg) {
            throw new lib_1.AppError('Replied-to message not found', types_1.STATUS_MESSAGES.NO_DATA);
        }
        // Ensure replied message involves either of the two participants
        const participants = [
            String(repliedMsg.sender?.id ?? ''),
            String(repliedMsg.receiver?.id ?? ''),
        ];
        if (!participants.includes(String(instructorId)) && !participants.includes(String(studentId))) {
            throw new lib_1.AppError('Invalid reply target for this conversation', types_1.STATUS_MESSAGES.NO_DATA);
        }
    }
    const createDoc = {
        sender,
        receiver,
        content: content.trim(),
        seenBy: [sender], // mark sender as having seen their own message
    };
    if (replyToObjId)
        createDoc.replyTo = replyToObjId;
    const newMsg = await models_1.Message.create(createDoc);
    // Populate replyTo snippet in returned object for client convenience
    const populated = await models_1.Message.findById(newMsg._id)
        .populate({ path: 'replyTo', select: 'content sender createdAt' })
        .lean();
    return res.out(populated, types_1.STATUS_MESSAGES.CREATED);
});
/**
 * GET /chat/message/:messageId
 * Returns a single message (populates replyTo).
 * Useful when client needs to fetch a reply target that is not currently in the DOM/paginated view.
 */
exports.getMessageById = (0, lib_1.asyncHandler)(async (req, res) => {
    const messageId = req.params.messageId;
    if (!(0, mongoose_1.isValidObjectId)(messageId)) {
        throw new lib_1.AppError('Invalid message id', types_1.STATUS_MESSAGES.NO_DATA);
    }
    const msg = await models_1.Message.findById(messageId)
        .populate({ path: 'replyTo', select: 'content sender createdAt' })
        .lean();
    if (!msg) {
        throw new lib_1.AppError('Message not found', types_1.STATUS_MESSAGES.NOT_FOUND);
    }
    return res.out(msg);
});
/**
 * POST /chat/message/:messageId/report
 * Body: { reason: string }
 *
 * Stores a report about the given message.
 * - reason (required)
 * - reporter is taken from req.user (id). If req.user.model exists we use it, else default to 'User'.
 * - user cannot report their own message.
 */
exports.reportMessage = (0, lib_1.asyncHandler)(async (req, res) => {
    const messageId = req.params.messageId;
    const { reason } = req.body;
    if (!(0, mongoose_1.isValidObjectId)(messageId)) {
        throw new lib_1.AppError('Invalid message id', types_1.STATUS_MESSAGES.NO_DATA);
    }
    if (!req.user || !req.user._id) {
        throw new lib_1.AppError('Unauthorized', types_1.STATUS_MESSAGES.UNAUTHORIZED);
    }
    if (typeof reason !== 'string' || !reason.trim()) {
        throw new lib_1.AppError('Report reason is required', types_1.STATUS_MESSAGES.NO_DATA);
    }
    const msg = await models_1.Message.findById(messageId).lean();
    if (!msg) {
        throw new lib_1.AppError('Message not found', types_1.STATUS_MESSAGES.NOT_FOUND);
    }
    // Prevent users from reporting their own message
    const reporterId = String(req.user._id);
    const msgSenderId = String(msg.sender.id);
    if (reporterId === msgSenderId) {
        throw new lib_1.AppError('You cannot report your own message', types_1.STATUS_MESSAGES.FORBIDDEN);
    }
    // determine reporter model (if available on req.user)
    const reporterModel = "Instructor";
    const reportDoc = await models_1.Report.create({
        messageId: new mongoose_1.Types.ObjectId(messageId),
        reporter: { id: new mongoose_1.Types.ObjectId(reporterId), model: reporterModel },
        reason: reason.trim(),
    });
    return res.out(reportDoc, types_1.STATUS_MESSAGES.CREATED);
});
