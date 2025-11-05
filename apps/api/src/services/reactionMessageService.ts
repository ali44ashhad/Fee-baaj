// src/services/reactionService.ts
import mongoose from 'mongoose';
import { isValidObjectId } from 'mongoose';
import { Message } from '@elearning/models'; // adjust import path if needed
import type { ReactionType } from '@elearning/types'; // adjust import path if needed

type ActorModel = 'User' | 'Instructor';

export interface ReactionResult {
  messageId: string;
  reactionCounts: Record<string, number>;
  userReaction: { type: ReactionType; id: string } | null;
}

/** Valid reactions - keep in sync with schema enum */
const VALID_REACTIONS = new Set(['like', 'love', 'wow', 'laugh', 'sad', 'angry']);

/**
 * NOTE: This implementation intentionally does NOT use transactions or sessions,
 * so it will work on standalone MongoDB instances. It aims to minimize race
 * windows by applying single update operations, but it is NOT fully ACID across
 * concurrent updates. If you later migrate to a replica set, you can reintroduce
 * transactions for stronger guarantees.
 */

/**
 * Upsert (create or update) a reaction for a message.
 * If same type is sent again - this implementation does NO-OP (safe).
 * To enable toggle (same type => remove) set toggleOnSame = true.
 */
export async function upsertMessageReaction(params: {
  messageId: string;
  userId: string;
  userModel: ActorModel;
  type: ReactionType;
  toggleOnSame?: boolean;
}): Promise<ReactionResult> {
  const { messageId, userId, userModel, type, toggleOnSame = false } = params;

  if (!isValidObjectId(messageId)) throw new Error('Invalid messageId');
  if (!isValidObjectId(userId)) throw new Error('Invalid userId');
  if (!VALID_REACTIONS.has(type)) throw new Error('Invalid reaction type');

  // Read the doc (non-transactional)
  const doc = await Message.findById(messageId).lean();
  if (!doc) throw new Error('Message not found');

  const userIdStr = String(userId);
  const reactions: any[] = Array.isArray(doc.reactions) ? doc.reactions : [];

  const existing = reactions.find((r: any) => String(r.user) === userIdStr);

  if (existing) {
    // user already reacted before
    if (existing.type === type) {
      // same type
      if (toggleOnSame) {
        // remove reaction
        const remaining = reactions.filter((r: any) => String(r.user) !== userIdStr);
        // recompute counts
        const newCounts: Record<string, number> = {};
        for (const r of remaining) newCounts[r.type] = (newCounts[r.type] || 0) + 1;

        await Message.updateOne(
          { _id: messageId },
          { $set: { reactions: remaining, reactionCounts: newCounts } }
        );

        const updated = await Message.findById(messageId).select('reactionCounts reactions').lean();
        return {
          messageId,
          reactionCounts: (updated?.reactionCounts as Record<string, number>) || {},
          userReaction: null,
        };
      } else {
        // no-op: return current state
        return {
          messageId,
          reactionCounts: (doc.reactionCounts as Record<string, number>) || {},
          userReaction: { type: existing.type as ReactionType, id: String(existing._id) },
        };
      }
    } else {
      // change type: update reaction entry and recompute counts
      const newReactions = reactions.map((r: any) =>
        String(r.user) === userIdStr ? { ...r, type, createdAt: new Date() } : r
      );

      const newCounts: Record<string, number> = {};
      for (const r of newReactions) newCounts[r.type] = (newCounts[r.type] || 0) + 1;

      await Message.updateOne(
        { _id: messageId },
        { $set: { reactions: newReactions, reactionCounts: newCounts } }
      );

      const updated = await Message.findById(messageId).select('reactionCounts reactions').lean();
      const userReactionDoc = (updated?.reactions || []).find((r: any) => String(r.user) === userIdStr) || null;

      return {
        messageId,
        reactionCounts: (updated?.reactionCounts as Record<string, number>) || {},
        userReaction: userReactionDoc ? { type: userReactionDoc.type as ReactionType, id: String(userReactionDoc._id) } : null,
      };
    }
  } else {
    // create new reaction
    const newReaction = { user: new mongoose.Types.ObjectId(userId), model: userModel, type, createdAt: new Date() };
    const newReactions = [...reactions, newReaction];

    const newCounts: Record<string, number> = {};
    for (const r of newReactions) newCounts[r.type] = (newCounts[r.type] || 0) + 1;

    // Write updated reactions+counts in a single update
    await Message.updateOne(
      { _id: messageId },
      { $set: { reactions: newReactions, reactionCounts: newCounts } }
    );

    const updated = await Message.findById(messageId).select('reactionCounts reactions').lean();
    const userReactionDoc = (updated?.reactions || []).find((r: any) => String(r.user) === userIdStr) || null;

    return {
      messageId,
      reactionCounts: (updated?.reactionCounts as Record<string, number>) || {},
      userReaction: userReactionDoc ? { type: userReactionDoc.type as ReactionType, id: String(userReactionDoc._id) } : null,
    };
  }
}

/**
 * Remove a user's reaction
 */
export async function removeMessageReaction(params: {
  messageId: string;
  userId: string;
}): Promise<ReactionResult> {
  const { messageId, userId } = params;

  if (!isValidObjectId(messageId)) throw new Error('Invalid messageId');
  if (!isValidObjectId(userId)) throw new Error('Invalid userId');

  const doc = await Message.findById(messageId).lean();
  if (!doc) throw new Error('Message not found');

  const userIdStr = String(userId);
  const reactions: any[] = Array.isArray(doc.reactions) ? doc.reactions : [];
  const existing = reactions.find((r: any) => String(r.user) === userIdStr);
  if (!existing) {
    // nothing to remove
    return { messageId, reactionCounts: (doc.reactionCounts as Record<string, number>) || {}, userReaction: null };
  }

  const remaining = reactions.filter((r: any) => String(r.user) !== userIdStr);
  const newCounts: Record<string, number> = {};
  for (const r of remaining) newCounts[r.type] = (newCounts[r.type] || 0) + 1;

  await Message.updateOne({ _id: messageId }, { $set: { reactions: remaining, reactionCounts: newCounts } });

  const updated = await Message.findById(messageId).select('reactionCounts reactions').lean();

  return {
    messageId,
    reactionCounts: (updated?.reactionCounts as Record<string, number>) || {},
    userReaction: null,
  };
}
