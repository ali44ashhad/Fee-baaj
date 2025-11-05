import React from 'react';
import type { IMessage } from '@elearning/types';

interface Props {
  message: IMessage;
  currentUserId: string | null | undefined;
  // optional className to tune placement inside bubble
  className?: string;
}

/**
 * Renders a small single/double check icon depending on whether the recipient
 * has seen the message. Caller should ensure this is rendered only for
 * the latest message that was sent by the current user.
 */
export default function MessageStatus({ message, currentUserId, className = '' }: Props) {
  if (!message || !currentUserId) return null;

  // If message not sent by current user, nothing to show
  const sentByMe = String((message.sender as any).id) === String(currentUserId);
  if (!sentByMe) return null;

  // Determine recipient id for this message (the other party)
  const recipientId = (message.receiver as any)?.id;
  if (!recipientId) return null;

  // Check if recipient is present in seenBy
  const seenBy = Array.isArray(message.seenBy) ? message.seenBy : [];
  const recipientSeen = seenBy.some((p: any) => String(p.id) === String(recipientId));

  const iconSrc = recipientSeen ? '/double-check.svg' : '/single-check.svg';
  const alt = recipientSeen ? 'Seen' : 'Sent';

  // small fixed size to match typical messaging UI
  return (
    <span className={`inline-flex items-center ml-2 ${className}`} aria-hidden>
      <img src={iconSrc} alt={alt} width={12} height={12} />
    </span>
  );
}
