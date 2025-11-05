/* server.ts (User API with unified Socket.IO) */
import mongoose from 'mongoose';
import { Server, Socket } from 'socket.io';
import app from './app';
import config from './config';
import { Message } from '@elearning/models';

// reaction service we wrote
import { upsertMessageReaction, removeMessageReaction } from './services/reactionMessageService';

// ─── Crash handlers ─────────────────────────────────────────────────────────────
process.on('uncaughtException', (err: Error) => {
  console.error('Unhandled exception 💥! Shutting down.');
  console.error(err.name, err.message);
  process.exit(1);
});
process.on('unhandledRejection', (err: any) => {
  console.error('Unhandled rejection 💥!', err);
  process.exit(1);
});

// Connect MongoDB & Start HTTP + Socket.IO
const PORT = config.api.port || 3004;
mongoose
  .connect(config.db.url!, { dbName: config.db.name })
  .then(() => {
    console.log('MongoDB connected 🔥');

    // In-memory presence sets
    const onlineUsers = new Set<string>();
    const onlineInstructors = new Set<string>();

    const httpServer = app.listen(PORT, () => {
      console.log(`API + Socket.IO running on port ${PORT}`);
    });

    const io = new Server(httpServer, {
      cors: {
        origin: [
          config.web.url,
          process.env.APP_URL!,
          process.env.WWWW_USER_APP,
          process.env.WWWW_USER_APP_COM,
          process.env.USER_APP_COM,
        ],
        methods: ['GET', 'POST'],
        credentials: true,
      },
      path: '/socket.io',
    });

    io.on('connection', (socket: Socket) => {
      console.log('🟢 Socket connected:', socket.id);

      // ask the client to identify themselves (client should then emit 'identify')
      socket.emit('requestIdentify');

      // identify handler
      socket.on(
        'identify',
        ({ id, model }: { id: string; model: 'User' | 'Instructor' }) => {
          socket.data.userId = id;
          socket.data.model = model;

          if (model === 'User') {
            onlineUsers.add(id);
            io.emit('UserOnline', { id });
          } else {
            onlineInstructors.add(id);
            io.emit('InstructorOnline', { id });
          }
        },
      );

      // Client can ask “is this id online?”
      socket.on(
        'checkOnlineStatus',
        (
          { id, model }: { id: string; model: 'User' | 'Instructor' },
          callback: (res: { online: boolean }) => void,
        ) => {
          const setToCheck = model === 'User' ? onlineUsers : onlineInstructors;
          callback({ online: setToCheck.has(id) });
        },
      );

      socket.on('joinRoom', ({ room }: { room: string }) => {
        const { userId, model } = socket.data;
        if (!room) return;
        console.log(`→ ${room} joined by ${model}:${userId}`);
        socket.join(room);
      });

      // ------------------------------
      // Typing indicators
      // ------------------------------
      // Unified typing event: { room?, receiverId?, receiverModel?, isTyping: boolean }
      // - If `room` is provided, server emits to that room excluding sender (socket.to(room).emit)
      // - Else if receiverId + receiverModel provided, server emits to that participant's personal room (io.to(`${model}:${id}`))
      // Also accept legacy 'startTyping' / 'stopTyping' events (mapped to typing).
      socket.on(
        'typing',
        (data: { room?: string; receiverId?: string; receiverModel?: 'User' | 'Instructor'; isTyping: boolean }) => {
          try {
            const { room, receiverId, receiverModel, isTyping } = data || {};
            const userId = socket.data.userId as string | undefined;
            const model = socket.data.model as 'User' | 'Instructor' | undefined;
            if (!userId || !model) {
              // not identified — ignore silently
              return;
            }

            const payload = { userId, model, isTyping };

            if (room && typeof room === 'string') {
              // emit to the room excluding sender
              socket.to(room).emit('typing', payload);
              return;
            }

            if (receiverId && receiverModel) {
              // emit directly to the receiver's personal room
              io.to(`${receiverModel}:${receiverId}`).emit('typing', payload);
              return;
            }

            // If nothing provided, as a fallback emit to all sockets of the other model (defensive; rarely used)
            // e.g., user might want to broadcast typing to all instructors (not typical). We'll avoid spam:
            // do nothing here to avoid accidental broadcast.
            console.warn('typing event received without room or receiver; ignored.');
          } catch (err) {
            console.error('typing handler error', err);
          }
        },
      );

      // convenience handlers for older clients that send startTyping/stopTyping
      socket.on('startTyping', (data: any) => {
        socket.emit('noop'); // optional keepalive for some clients; no-op
        // map to typing with isTyping: true
        try {
          const payload = {
            room: data?.room,
            receiverId: data?.receiverId,
            receiverModel: data?.receiverModel,
            isTyping: true,
          };
          socket.emit && socket.emit('noop'); // no-op if needed
          // reuse typing handler logic by emitting event on the socket
          socket.emit('typing', payload);
        } catch (err) {
          // ignore
        }
      });

      socket.on('stopTyping', (data: any) => {
        try {
          const payload = {
            room: data?.room,
            receiverId: data?.receiverId,
            receiverModel: data?.receiverModel,
            isTyping: false,
          };
          socket.emit('typing', payload);
        } catch (err) {
          // ignore
        }
      });

      // ------------------------------
      // Message sending handlers (with clientTempId + callback ack)
      // ------------------------------
      // User sends message to Instructor in a unique room
      socket.on(
        'sendMessage',
        async (
          data: {
            receiverId: string;
            content: string;
            room: string;
            senderId: string;
            clientTempId?: string;
            replyTo?: string | null;
          },
          callback?: (ack: any) => void,
        ) => {
          try {
            const { receiverId, content, room, senderId, clientTempId, replyTo } = data;
            const sender = { id: new mongoose.Types.ObjectId(senderId), model: 'User' as const };
            const receiver = { id: new mongoose.Types.ObjectId(receiverId), model: 'Instructor' as const };

            // If a replyTo is provided, validate it exists and belongs to the same conversation participants
            let replyToObjectId: mongoose.Types.ObjectId | null = null;
            if (replyTo) {
              if (!mongoose.isValidObjectId(replyTo)) {
                if (typeof callback === 'function') {
                  return callback({ ok: false, message: 'Invalid replyTo id' });
                }
                return socket.emit('error', { message: 'Invalid replyTo id' });
              }
              replyToObjectId = new mongoose.Types.ObjectId(replyTo);
              const repliedMsg = await Message.findById(replyToObjectId).lean();
              if (!repliedMsg) {
                if (typeof callback === 'function') {
                  return callback({ ok: false, message: 'Replied-to message not found' });
                }
                return socket.emit('error', { message: 'Replied-to message not found' });
              }

              // Ensure replied message involves either sender or receiver (defensive)
              const participants = [
                String(repliedMsg.sender?.id ?? ''),
                String(repliedMsg.receiver?.id ?? ''),
              ];
              if (
                !participants.includes(String(sender.id)) &&
                !participants.includes(String(receiver.id))
              ) {
                if (typeof callback === 'function') {
                  return callback({ ok: false, message: 'Invalid reply target for this conversation' });
                }
                return socket.emit('error', { message: 'Invalid reply target for this conversation' });
              }
            }

            const createDoc: any = {
              sender,
              receiver,
              content,
              seenBy: [sender],
            };
            if (replyToObjectId) createDoc.replyTo = replyToObjectId;

            const newMsg = await Message.create(createDoc);

            // Populate a small replyTo snippet for the payload so clients can render immediately
            const saved = await Message.findById(newMsg._id)
              .populate({
                path: 'replyTo',
                select: 'content sender createdAt',
              })
              .lean();

            const payload = { ...saved, sender, receiver };

            // Emit to the room (other participants)
            if (room) {
              socket.to(room).emit('newMessage', { ...payload, sentByMe: false });
            }

            io.to(`Instructor:${receiverId}`).emit('newMessage', { ...payload, sentByMe: false, fromRoom: room || null });           

            // Ack to caller (so they can map clientTempId -> server id)
            if (typeof callback === 'function') {
              callback({ ok: true, data: { message: payload, clientTempId: clientTempId ?? null } });
            }
          } catch (err) {
            console.error('sendMessage handler error', err);
            if (typeof callback === 'function') {
              callback({ ok: false, message: 'Failed to send message' });
            } else {
              socket.emit('error', { message: 'Failed to send message' });
            }
          }
        },
      );

      // Instructor sends message to User in a unique room
      socket.on(
        'instructorSendMessage',
        async (
          data: {
            senderId: string;
            receiverId: string;
            content: string;
            room: string;
            clientTempId?: string;
            replyTo?: string | null;
          },
          callback?: (ack: any) => void,
        ) => {
          try {
            const { senderId, receiverId, content, room, clientTempId, replyTo } = data;
            const sender = { id: new mongoose.Types.ObjectId(senderId), model: 'Instructor' as const };
            const receiver = { id: new mongoose.Types.ObjectId(receiverId), model: 'User' as const };

            // replyTo validation (same pattern)
            let replyToObjectId: mongoose.Types.ObjectId | null = null;
            if (replyTo) {
              if (!mongoose.isValidObjectId(replyTo)) {
                if (typeof callback === 'function') {
                  return callback({ ok: false, message: 'Invalid replyTo id' });
                }
                return socket.emit('error', { message: 'Invalid replyTo id' });
              }
              replyToObjectId = new mongoose.Types.ObjectId(replyTo);
              const repliedMsg = await Message.findById(replyToObjectId).lean();
              if (!repliedMsg) {
                if (typeof callback === 'function') {
                  return callback({ ok: false, message: 'Replied-to message not found' });
                }
                return socket.emit('error', { message: 'Replied-to message not found' });
              }

              const participants = [
                String(repliedMsg.sender?.id ?? ''),
                String(repliedMsg.receiver?.id ?? ''),
              ];
              if (
                !participants.includes(String(sender.id)) &&
                !participants.includes(String(receiver.id))
              ) {
                if (typeof callback === 'function') {
                  return callback({ ok: false, message: 'Invalid reply target for this conversation' });
                }
                return socket.emit('error', { message: 'Invalid reply target for this conversation' });
              }
            }

            const createDoc: any = {
              sender,
              receiver,
              content,
              seenBy: [],
            };
            if (replyToObjectId) createDoc.replyTo = replyToObjectId;

            const newMsg = await Message.create(createDoc);

            const saved = await Message.findById(newMsg._id)
              .populate({ path: 'replyTo', select: 'content sender createdAt' })
              .lean();

            const payload = { ...saved, sender, receiver };

            if (room) {
              socket.to(room).emit('newMessage', { ...payload, sentByMe: false });
            }

            io.to(`User:${receiverId}`).emit('newMessage', { ...payload, sentByMe: false, fromRoom: room || null });    

            if (typeof callback === 'function') {
              callback({ ok: true, data: { message: payload, clientTempId: clientTempId ?? null } });
            }
          } catch (err) {
            console.error('instructorSendMessage handler error', err);
            if (typeof callback === 'function') {
              callback({ ok: false, message: 'Failed to send message' });
            } else {
              socket.emit('error', { message: 'Failed to send message' });
            }
          }
        },
      );

      // ------------------------------
      // MARK AS SEEN (unchanged)
      // ------------------------------
      socket.on('markAsSeen', async ({ messageId }: { messageId: string }) => {
        try {
          console.log('markAsSeen received from', socket.data.model, socket.data.userId, 'messageId', messageId);
          const me = { id: new mongoose.Types.ObjectId(socket.data.userId), model: socket.data.model };
          const updated = await Message.findByIdAndUpdate(
            messageId,
            { $addToSet: { seenBy: me } },
            { new: true },
          );
          if (!updated) return;
          [updated.sender, updated.receiver].forEach((p) => {
            io.to(`${p.model}:${p.id}`).emit('messageSeen', {
              messageId: updated._id,
              seenBy: updated.seenBy,
            });
          });
        } catch (err) {
          console.error('markAsSeen error', err);
        }
      });

      // ------------------------------
      // REACTIONS: reactToMessage & removeMessageReaction (unchanged)
      // ------------------------------
      // Add at top of file if not already:
      // import mongoose from 'mongoose';

      socket.on(
        'reactToMessage',
        async (data: { messageId: string; type: string; toggleOnSame?: boolean }) => {
          const { messageId, type, toggleOnSame } = data || {};
          const userId = socket.data.userId as string | undefined;
          const userModel = socket.data.model as 'User' | 'Instructor' | undefined;

          if (!userId || !userModel) {
            socket.emit('reactAck', { ok: false, message: 'Not identified' });
            return;
          }

          if (!messageId || !mongoose.isValidObjectId(messageId)) {
            socket.emit('reactAck', { ok: false, message: 'Invalid messageId' });
            return;
          }

          try {
            // Call service
            const res = await upsertMessageReaction({
              messageId,
              userId,
              userModel,
              type: type as any,
              toggleOnSame: !!toggleOnSame,
            });

            if (!res || !res.messageId) {
              console.warn('upsertMessageReaction returned no result', { messageId, userId, res });
              socket.emit('reactAck', { ok: false, message: 'Reaction service returned no result' });
              return;
            }

            // Fetch participants to emit to their personal rooms
            const msg = await Message.findById(messageId).select('sender receiver').lean();
            const targets: Array<{ model: string; id: string }> = [];

            if (msg?.sender) {
              const sModel = (msg.sender as any).model;
              const sId = (msg.sender as any).id?.toString?.();
              if (sModel && sId) targets.push({ model: sModel, id: sId });
            }
            if (msg?.receiver) {
              const rModel = (msg.receiver as any).model;
              const rId = (msg.receiver as any).id?.toString?.();
              if (rModel && rId) targets.push({ model: rModel, id: rId });
            }

            const payload = { messageId: res.messageId, reactionCounts: res.reactionCounts, userReaction: res.userReaction };


            if (targets.length === 0) {
              // Defensive logging — this is the common cause of "nobody got the update"
              console.warn('reactToMessage: no sender/receiver found for message', {
                messageId,
                serviceResult: res,
              });
              // Optionally, emit to the acting user so at least they receive the ack/payload
              io.to(`User:${userId}`).emit('messageReactionUpdated', payload);
            } else {
              targets.forEach((p) => {
                try {
                  io.to(`${p.model}:${p.id}`).emit('messageReactionUpdated', payload);
                  console.log(`messageReactionUpdated emitted to ${p.model}:${p.id} for message ${messageId}`);
                } catch (emitErr) {
                  console.warn('emit failed for messageReactionUpdated', { to: `${p.model}:${p.id}`, emitErr });
                }
              });
            }

            socket.emit('reactAck', { ok: true, data: payload });
          } catch (err: any) {
            console.error('reactToMessage error', {
              messageId,
              userId,
              userModel,
              errMessage: err?.message,
              stack: err?.stack,
            });

            // Provide a clearer ack to client while preserving original error message
            const publicMessage =
              typeof err?.message === 'string' && err.message.includes('Transaction numbers are only allowed')
                ? 'Database transaction error (standalone MongoDB). Consider enabling replica set or removing transactions.'
                : err?.message ?? 'Reaction failed';

            socket.emit('reactAck', { ok: false, message: publicMessage });
          }
        },
      );

      socket.on('removeMessageReaction', async (data: { messageId: string }) => {
        const { messageId } = data || {};
        const userId = socket.data.userId as string | undefined;

        if (!userId) {
          socket.emit('removeReactionAck', { ok: false, message: 'Not identified' });
          return;
        }

        if (!messageId || !mongoose.isValidObjectId(messageId)) {
          socket.emit('removeReactionAck', { ok: false, message: 'Invalid messageId' });
          return;
        }

        try {
          const res = await removeMessageReaction({ messageId, userId });

          if (!res || !res.messageId) {
            console.warn('removeMessageReaction returned no result', { messageId, userId, res });
            socket.emit('removeReactionAck', { ok: false, message: 'Remove reaction service returned no result' });
            return;
          }

          const msg = await Message.findById(messageId).select('sender receiver').lean();
          const targets: Array<{ model: string; id: string }> = [];

          if (msg?.sender) {
            const sModel = (msg.sender as any).model;
            const sId = (msg.sender as any).id?.toString?.();
            if (sModel && sId) targets.push({ model: sModel, id: sId });
          }
          if (msg?.receiver) {
            const rModel = (msg.receiver as any).model;
            const rId = (msg.receiver as any).id?.toString?.();
            if (rModel && rId) targets.push({ model: rModel, id: rId });
          }

          const payload = { messageId: res.messageId, reactionCounts: res.reactionCounts, userReaction: null };

          if (targets.length === 0) {
            console.warn('removeMessageReaction: no sender/receiver found for message', { messageId });
            io.to(`User:${userId}`).emit('messageReactionUpdated', payload);
          } else {
            targets.forEach((p) => {
              try {
                io.to(`${p.model}:${p.id}`).emit('messageReactionUpdated', payload);
                console.log(`messageReactionUpdated (remove) emitted to ${p.model}:${p.id} for message ${messageId}`);
              } catch (emitErr) {
                console.warn('emit failed for messageReactionUpdated (remove)', { to: `${p.model}:${p.id}`, emitErr });
              }
            });
          }

          socket.emit('removeReactionAck', { ok: true, data: payload });
        } catch (err: any) {
          console.error('removeMessageReaction error', { messageId, userId, errMessage: err?.message, stack: err?.stack });

          const publicMessage =
            typeof err?.message === 'string' && err.message.includes('Transaction numbers are only allowed')
              ? 'Database transaction error (standalone MongoDB). Consider enabling replica set or removing transactions.'
              : err?.message ?? 'Remove reaction failed';

          socket.emit('removeReactionAck', { ok: false, message: publicMessage });
        }
      });




      socket.on('deleteMessage', async (data: { messageId: string }, callback?: (ack: any) => void) => {
        try {
          const { messageId } = data || {};
          const userId = socket.data.userId as string | undefined;
          const userModel = socket.data.model as 'User' | 'Instructor' | undefined;

          if (!userId || !userModel) {
            if (typeof callback === 'function') return callback({ ok: false, message: 'Not identified' });
            return;
          }

          if (!mongoose.isValidObjectId(messageId)) {
            if (typeof callback === 'function') return callback({ ok: false, message: 'Invalid message id' });
            return;
          }

          const msg = await Message.findById(messageId).lean();
          if (!msg) {
            if (typeof callback === 'function') return callback({ ok: false, message: 'Message not found' });
            return;
          }

          // Only the sender may delete their own message
          const senderId = String((msg.sender as any).id);
          const senderModel = (msg.sender as any).model as 'User' | 'Instructor';
          if (String(userId) !== senderId || userModel !== senderModel) {
            if (typeof callback === 'function') return callback({ ok: false, message: 'Forbidden: only sender can delete' });
            return;
          }

          // Perform soft-delete
          const updated = await Message.findByIdAndUpdate(
            messageId,
            {
              isDeleted: true,
              deletedBy: { id: new mongoose.Types.ObjectId(userId), model: userModel },
              deletedAt: new Date(),
            },
            { new: true },
          )
            .populate({ path: 'replyTo', select: 'content sender createdAt' })
            .lean();

          if (!updated) {
            if (typeof callback === 'function') return callback({ ok: false, message: 'Failed to delete message' });
            return;
          }

          // Emit deletion event to both participants' personal rooms
          const payload = {
            messageId: updated._id,
            isDeleted: true,
            deletedBy: updated.deletedBy,
            deletedAt: updated.deletedAt,
          };

          try {
            if (updated.sender) {
              io.to(`${(updated.sender as any).model}:${(updated.sender as any).id}`).emit('messageDeleted', payload);
            }
            if (updated.receiver) {
              io.to(`${(updated.receiver as any).model}:${(updated.receiver as any).id}`).emit('messageDeleted', payload);
            }
          } catch (emitErr) {
            console.warn('messageDeleted emit failed', emitErr);
          }

          if (typeof callback === 'function') {
            return callback({ ok: true, data: payload });
          }
        } catch (err) {
          console.error('deleteMessage handler error', err);
          if (typeof callback === 'function') return callback({ ok: false, message: 'Delete failed' });
        }
      });


      // ------------------------------
      // Disconnect (unchanged)
      // ------------------------------
      socket.on('disconnect', (reason) => {
        const { userId, model } = socket.data as { userId?: string; model?: 'User' | 'Instructor' };
        if (!userId || !model) return;

        if (model === 'User' && onlineUsers.delete(userId)) {
          io.emit('UserOffline', { id: userId });
        }
        if (model === 'Instructor' && onlineInstructors.delete(userId)) {
          io.emit('InstructorOffline', { id: userId });
        }

        console.log(`🔴 ${model}:${userId} disconnected — because ${reason}`);
      });
    });
  })
  .catch((err) => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });
