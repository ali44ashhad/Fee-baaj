import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { SocketProvider } from '@/hooks/SocketContext';
import MobileChat from './MobileChat';
import DesktopChat from './DesktopChat';
import { fetchInstructor, fetchUserConversations } from './api';

export default function InstructorChat() {
  const { insId } = useParams<{ insId: string }>();
  const navigate = useNavigate();

  const [instructor, setInstructor] = useState<any>(null);
  const [conversations, setConversations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  // requestIdRef helps ignore stale/out-of-order responses without AbortController
  const requestIdRef = useRef(0);

  useEffect(() => {
    if (!insId) {
      setInstructor(null);
      setConversations([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setInstructor(null);
    setConversations([]);

    const currentReqId = ++requestIdRef.current;

    (async () => {
      try {
        // NOTE: do NOT pass a second `signal` object here since fetchInstructor's signature expects only 1 arg.
        const [ins, convs] = await Promise.all([
          fetchInstructor(insId), // <-- one arg only
          fetchUserConversations(insId), // <-- one arg only
        ]);

        // If another request started after this one, ignore this result
        if (currentReqId !== requestIdRef.current) return;

        // Defensive check: ensure instructor returned corresponds to requested insId (optional)
        if (ins && (ins._id?.toString() !== insId && ins._id?.toString() !== insId)) {
          console.warn('[Instructor mismatch] server returned instructor.id != insId', { insId, ins });
          return;
        }

        setInstructor(ins);
        setConversations(convs || []);
      } catch (err: any) {
        // If you have network errors, log them — no AbortError handling here since we're not using AbortController
        console.error('Load error:', err);
      } finally {
        if (currentReqId === requestIdRef.current) setLoading(false);
      }
    })();
  }, [insId]);

  // Prevent pinch zoom / wheel / zoom key handling
  useEffect(() => {
    const handleTouchMove = (e: TouchEvent) => {
      
      if ((e as any).scale && (e as any).scale !== 1) e.preventDefault();
    };
    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) e.preventDefault();
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      const zoomKeys = ['+', '-', '=', '0'];
      if ((e.ctrlKey || e.metaKey) && zoomKeys.includes(e.key)) e.preventDefault();
    };

    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('wheel', handleWheel, { passive: false });
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('wheel', handleWheel);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // Detect mobile vs desktop
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  if (loading) {
    return <div className="flex-1 flex items-center justify-center">Loading chat…</div>;
  }

  if (!instructor) {
    return <div className="flex-1 flex items-center justify-center">Instructor not found.</div>;
  }

  if (conversations.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-gray-500 space-y-4">
        <p className="text-lg">You have no messages yet from students.</p>
        <button
          onClick={() => navigate(-1)}
          className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary-dark"
        >
          Go Back
        </button>
      </div>
    );
  }

  const avatarUrl = instructor.pictureUrl || '/userPlaceHolder.jpg';
  const commonProps = {
    insId: insId!,
    instructorAvatarUrl: avatarUrl,
    instructorName: instructor.name,
    instructorProfession: instructor.profession,
    chats: conversations,
  };

  // Key the provider with insId to force a remount when the param changes
  return (
    <SocketProvider key={insId}>
      {isMobile ? <MobileChat {...commonProps} /> : <DesktopChat {...commonProps} />}
    </SocketProvider>
  );
}
