'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import MobileChat from './components/MobileChat';
import DesktopChat from './components/DesktopChat';
import { SocketProvider } from '@/hooks/SocketContext';
import { fetchInstructor, fetchMessages, fetchConversations } from '../actions';
import { useAuth } from '@/hooks/use-auth';

const INITIAL_LIMIT = 6; // number of latest messages to preload
const MEDIA_URL =  process.env.NEXT_PUBLIC_MEDIA_API_URL || "";

export default function InstructorChatPage() {
  const params = useParams();
  let insId = params.insId;
  if (Array.isArray(insId)) insId = insId[0]!;
  const router = useRouter();

  // Auth check
  const { isAuthenticated, isLoading } = useAuth();

  // Redirect back if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.back();
    }
  }, [isLoading, isAuthenticated, router]);

  // Local state
  const [instructor, setInstructor] = useState<any>(null);
  const [conversations, setConversations] = useState<any[]>([]);
  const [initialMessages, setInitialMessages] = useState<any[]>([]);
  const [initialHasMore, setInitialHasMore] = useState<boolean>(false);
  const [loading, setLoading] = useState(true);

  // prevent zoom on mobile
  useEffect(() => {
    const meta = document.createElement('meta');
    meta.name = 'viewport';
    meta.content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no';
    document.head.appendChild(meta);

    return () => {
      document.head.removeChild(meta);
    };
  }, []);

  useEffect(() => {
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey) {
        e.preventDefault();
      }
    };
    window.addEventListener('wheel', onWheel, { passive: false });
    return () => window.removeEventListener('wheel', onWheel);
  }, []);

  // Sort conversations by lastMessageAt (newest first)
  const sortConversations = (convos: any[]) => {
    return convos.sort((a, b) => {
      const dateA = new Date(a.lastMessageAt).getTime();
      const dateB = new Date(b.lastMessageAt).getTime();
      return dateB - dateA; // Sort in descending order (newest first)
    });
  };

  // Load data once auth is confirmed
  useEffect(() => {
    if (isLoading || !isAuthenticated) return;
    if (!insId) return;

    (async () => {
      setLoading(true);
      try {
        // 1) Load instructor profile
        const inst = await fetchInstructor(insId as string);
        setInstructor(inst);

        // 2) Load conversation summaries
        let convos = await fetchConversations();
        
        // Sort conversations by lastMessageAt
        convos = sortConversations(convos);
        
        if (!convos.some((c) => c.instructorId === insId)) {
          const avatarUrl = inst.pictureId
            ? `${process.env.NEXT_PUBLIC_API_URL}/images/${inst.pictureId}`
            : '/userPlaceHolder.jpg';
          convos = [
            {
              instructorId: insId as string,
              name: inst.name,
              pictureId: inst.pictureId || undefined,
              pictureUrl: inst.pictureUrl,
              profession:inst.profession,
              lastMessage: 'No messages yet',
              lastMessageAt: new Date().toISOString(),
              unreadCount: 0,
            },
            ...convos,
          ];
        }
        setConversations(convos);

        // 3) Load initial (latest) message chunk (page=1, limit = INITIAL_LIMIT)
        // fetchMessages returns { messages, hasMore }
        const { messages, hasMore } = await fetchMessages(insId as string, 1, INITIAL_LIMIT);
        // normalize to array (safety)
        setInitialMessages(Array.isArray(messages) ? messages : []);
        setInitialHasMore(Boolean(hasMore));
      } catch (err) {
        console.error('Failed to initialize chat page:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, [insId, isLoading, isAuthenticated]);

  // Show loader while any loading
  if (loading || isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <span className="text-gray-500">Loading chat…</span>
      </div>
    );
  }

  // If instructor not found
  if (!instructor) {
    return (
      <div className="flex items-center justify-center h-screen">
        <span className="text-red-500">Error: Instructor not found</span>
      </div>
    );
  }



  return (
    <SocketProvider>
      {/* Mobile view */}
      <div className="block md:hidden overflow-hidden">
        <MobileChat
          insId={insId as string}
          instructorName={instructor.name}
          instructorAvatarUrl={instructor.pictureUrl || "/userPlaceHolder.jpg"}
          initialMessages={initialMessages}
          instructorProfession={instructor.profession}
          initialHasMore={initialHasMore}
          chats={conversations}
        />
      </div>
      {/* Desktop view */}
      <div className="hidden md:block">
        <DesktopChat
          insId={insId as string}
          instructorName={instructor.name}
          instructorAvatarUrl={instructor.pictureUrl || "/userPlaceHolder.jpg"}
          instructorProfession={instructor.profession}
          initialMessages={initialMessages}
          initialHasMore={initialHasMore}
          chats={conversations}
        />
      </div>
    </SocketProvider>
  );
}