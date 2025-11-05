// src/api/chat.controller.ts
import { Request, Response } from 'express';
import { asyncHandler, AppError } from '@elearning/lib';
import { Message, User, Report } from '@elearning/models';
import mongoose, { isValidObjectId, Types } from 'mongoose';
import { STATUS_MESSAGES } from '@elearning/types';

/**
 * GET /chat/instructor/:insId/messages/summary
 * List student threads for this instructor
 */
export const getUserConversationsForInstructor = asyncHandler(async (req, res) => {
  const insId = req.params.insId;
  if (!isValidObjectId(insId)) {
    throw new AppError('Invalid instructor ID', STATUS_MESSAGES.NO_DATA);
  }
  const insObjId = new mongoose.Types.ObjectId(insId);

  // 1) Latest per student
  const latest = await Message.aggregate([
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
              { $eq: ['$sender.model','User'] }, '$sender.id', '$receiver.id'
            ]
          }
        },
        lastMessage:   { $first: '$content' },
        lastMessageAt: { $first: '$createdAt' }
    }}
  ]);

  const studentIds = latest.map(x => x._id.userId);

  // 2) Unread counts
  const unread = await Message.aggregate([
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
  const unreadMap = unread.reduce<Record<string,number>>((m, x) => {
    m[x._id.toString()] = x.count;
    return m;
  }, {});

  // 3) Load student profiles
  const students = await User.find({ _id: { $in: studentIds } })
    .select('name pictureUrl isVerified')
    .lean();
  const studentMap = Object.fromEntries(
    students.map(u => [u._id.toString(), u])
  );

  // 4) Build response
  const conversations = latest.map(item => {
    const uid = item._id.userId.toString();
    const usr = studentMap[uid];
    if (!usr) return null;
    return {
      userId:        uid,
      name:          usr.name,
      pictureUrl:    usr.pictureUrl || null,
      isVerified:    usr.isVerified,
      lastMessage:   item.lastMessage,
      lastMessageAt: item.lastMessageAt,
      unreadCount:   unreadMap[uid] || 0
    };
  }).filter(Boolean);

  return res.out({ conversations });
});

/**
 * GET /chat/instructor/student/:studentId/messages
 * Fetch 1:1 thread between the authenticated instructor and a student
 */
export const getInstructorMessages = asyncHandler(async (req: Request, res: Response) => {
  const instructorId = req.params.insId; // Authenticated instructor
  const studentId = req.params.userId; // Student ID from params

  if (!isValidObjectId(studentId)) {
    throw new AppError('Invalid student ID', STATUS_MESSAGES.NO_DATA);
  }

  if (!isValidObjectId(instructorId)) {
    throw new AppError('Invalid instructor ID', STATUS_MESSAGES.NO_DATA);
  }


  const MAX_LIMIT = 100;
  const DEFAULT_LIMIT = 20;

  // Parse limit
  let limit = Number(req.query.limit) || DEFAULT_LIMIT;
  if (limit <= 0) limit = DEFAULT_LIMIT;
  limit = Math.min(limit, MAX_LIMIT);

  // We fetch limit + 1 to know whether there are older messages
  const fetchLimit = limit + 1;

  // Parse "before" for pagination
  const beforeRaw = (req.query.before as string) || undefined;
  let beforeDate: Date | undefined;
  
  if (beforeRaw) {
    const d = new Date(beforeRaw);
    if (!isNaN(d.getTime())) {
      beforeDate = d;
    } else {
      throw new AppError('Invalid "before" timestamp', STATUS_MESSAGES.NO_DATA);
    }
  }

  // Build filter for messages between instructor and student
  const baseFilter: any = {
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
  let query = Message.find(baseFilter).sort({ createdAt: -1 }).limit(fetchLimit);

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


export const getInstructorMessagesAround = asyncHandler(async (req: Request, res: Response) => {
  const instructorId = req.params.instructorId; // Authenticated instructor
  const studentId = req.params.studentId; // Student ID from params
  const aroundId = req.params.aroundId || (req.query.around as string | undefined);

  if (!isValidObjectId(studentId)) {
    throw new AppError('Invalid student ID', STATUS_MESSAGES.NO_DATA);
  } 
  if (!aroundId || !isValidObjectId(aroundId)) {
    throw new AppError('Invalid around message id', STATUS_MESSAGES.NO_DATA);
  }

  const MAX_LIMIT = 200;
  const DEFAULT_LIMIT = 40;
  let limit = Number(req.query.limit) || DEFAULT_LIMIT;
  if (limit <= 0) limit = DEFAULT_LIMIT;
  limit = Math.min(limit, MAX_LIMIT);

  // Find the target message first (ensure it belongs to the conversation)
  const pivot = await Message.findById(aroundId).lean();
  if (!pivot) {
    throw new AppError('Target message not found', STATUS_MESSAGES.NOT_FOUND);
  }

  // Ensure pivot belongs to the conversation between instructor & student
  const participants = [
    String(pivot.sender?.id ?? ''),
    String(pivot.receiver?.id ?? ''),
  ];
  if (!participants.includes(String(instructorId)) && !participants.includes(String(studentId))) {
    throw new AppError('Target message is not part of this conversation', STATUS_MESSAGES.NO_DATA);
  }

  // We will fetch up to half before, half after (plus pivot)
  const half = Math.floor(limit / 2);

  // Base conversation filter
  const baseFilter: any = {
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
  const beforeQuery = Message.find({
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
  const afterQuery = Message.find({
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
    const countOlder = await Message.countDocuments({
      ...baseFilter,
      $or: [
        { createdAt: { $lt: lastBefore.createdAt } },
        { createdAt: lastBefore.createdAt, _id: { $lt: lastBefore._id } },
      ],
    }).exec();
    hasMoreBefore = countOlder > 0;
  } else {
    // if no beforeDocs, pivot might be earliest chunk; check if any older than pivot
    const countOlder = await Message.countDocuments({
      ...baseFilter,
      $or: [{ createdAt: { $lt: pivot.createdAt } }, { createdAt: pivot.createdAt, _id: { $lt: pivot._id } }],
    }).exec();
    hasMoreBefore = countOlder > 0;
  }

  let hasMoreAfter = false;
  if (afterDocs.length > 0) {
    const lastAfter = afterDocs[afterDocs.length - 1];
    const countNewer = await Message.countDocuments({
      ...baseFilter,
      $or: [{ createdAt: { $gt: lastAfter.createdAt } }, { createdAt: lastAfter.createdAt, _id: { $gt: lastAfter._id } }],
    }).exec();
    hasMoreAfter = countNewer > 0;
  } else {
    // if no afterDocs, check if there are messages newer than pivot
    const countNewer = await Message.countDocuments({
      ...baseFilter,
      $or: [{ createdAt: { $gt: pivot.createdAt } }, { createdAt: pivot.createdAt, _id: { $gt: pivot._id } }],
    }).exec();
    hasMoreAfter = countNewer > 0;
  }

  // Build chronological results: older (reverse the desc list) + pivot + after (already asc)
  const olderChron = (beforeDocs || []).slice().reverse();
  const pivotPopulated = await Message.findById(pivot._id)
    .populate({ path: 'replyTo', select: 'content sender createdAt' })
    .lean();

  const messages = [...olderChron, pivotPopulated, ...(afterDocs || [])].filter(Boolean);

  return res.out({ messages, hasMoreBefore, hasMoreAfter });
});

/**
 * POST /chat/instructor/student/:studentId/message
 * Instructor → student message
 */
export const postInstructorMessage = asyncHandler(async (req: Request, res: Response) => {
  const instructorId = req.user!._id; // Authenticated instructor
  const studentId = req.params.studentId;
  const { content, replyTo } = req.body as { content?: string; replyTo?: string | null };

  if (!isValidObjectId(studentId)) {
    throw new AppError('Invalid student ID', STATUS_MESSAGES.NOT_FOUND);
  }
  if (typeof content !== 'string' || !content.trim()) {
    throw new AppError('Message content is required', STATUS_MESSAGES.NO_DATA);
  }

  const sender = {
    id: instructorId,
    model: 'Instructor' as const,
  };
  const receiver = {
    id: new Types.ObjectId(studentId),
    model: 'User' as const,
  };

  // Validate replyTo if provided
  let replyToObjId: Types.ObjectId | null = null;
  if (replyTo) {
    if (!isValidObjectId(replyTo)) {
      throw new AppError('Invalid replyTo id', STATUS_MESSAGES.NO_DATA);
    }
    replyToObjId = new Types.ObjectId(replyTo);
    const repliedMsg = await Message.findById(replyToObjId).lean();
    if (!repliedMsg) {
      throw new AppError('Replied-to message not found', STATUS_MESSAGES.NO_DATA);
    }

    // Ensure replied message involves either of the two participants
    const participants = [
      String(repliedMsg.sender?.id ?? ''),
      String(repliedMsg.receiver?.id ?? ''),
    ];
    if (!participants.includes(String(instructorId)) && !participants.includes(String(studentId))) {
      throw new AppError('Invalid reply target for this conversation', STATUS_MESSAGES.NO_DATA);
    }
  }

  const createDoc: any = {
    sender,
    receiver,
    content: content.trim(),
    seenBy: [sender], // mark sender as having seen their own message
  };
  if (replyToObjId) createDoc.replyTo = replyToObjId;

  const newMsg = await Message.create(createDoc);

  // Populate replyTo snippet in returned object for client convenience
  const populated = await Message.findById(newMsg._id)
    .populate({ path: 'replyTo', select: 'content sender createdAt' })
    .lean();

  return res.out(populated, STATUS_MESSAGES.CREATED);
});
/**
 * GET /chat/message/:messageId
 * Returns a single message (populates replyTo).
 * Useful when client needs to fetch a reply target that is not currently in the DOM/paginated view.
 */
export const getMessageById = asyncHandler(async (req: Request, res: Response) => {
  const messageId = req.params.messageId;
  if (!isValidObjectId(messageId)) {
    throw new AppError('Invalid message id', STATUS_MESSAGES.NO_DATA);
  }

  const msg = await Message.findById(messageId)
    .populate({ path: 'replyTo', select: 'content sender createdAt' })
    .lean();

  if (!msg) {
    throw new AppError('Message not found', STATUS_MESSAGES.NOT_FOUND);
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
export const reportMessage = asyncHandler(async (req: Request, res: Response) => {
  const messageId = req.params.messageId;
  const { reason } = req.body as { reason?: string };

  if (!isValidObjectId(messageId)) {
    throw new AppError('Invalid message id', STATUS_MESSAGES.NO_DATA);
  }

  if (!req.user || !req.user._id) {
    throw new AppError('Unauthorized', STATUS_MESSAGES.UNAUTHORIZED);
  }

  if (typeof reason !== 'string' || !reason.trim()) {
    throw new AppError('Report reason is required', STATUS_MESSAGES.NO_DATA);
  }

  const msg = await Message.findById(messageId).lean();
  if (!msg) {
    throw new AppError('Message not found', STATUS_MESSAGES.NOT_FOUND);
  }

  // Prevent users from reporting their own message
  const reporterId = String(req.user._id);
  const msgSenderId = String((msg.sender as any).id);
  if (reporterId === msgSenderId) {
    throw new AppError('You cannot report your own message', STATUS_MESSAGES.FORBIDDEN);
  }

  // determine reporter model (if available on req.user)
  const reporterModel = "Instructor";

  const reportDoc = await Report.create({
    messageId: new Types.ObjectId(messageId),
    reporter: { id: new Types.ObjectId(reporterId), model: reporterModel },
    reason: reason.trim(),
  });

  return res.out(reportDoc, STATUS_MESSAGES.CREATED);
});