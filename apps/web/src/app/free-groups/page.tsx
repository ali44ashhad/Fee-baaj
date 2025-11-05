'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { fetchConversations, fetchMessages } from '../chat/instructor/actions';
import { useAuth } from '@/hooks/use-auth';
import MobileChat from '../chat/instructor/[insId]/components/MobileChat';
import DesktopChat from '../chat/instructor/[insId]/components/DesktopChat';
import { SocketProvider } from '@/hooks/SocketContext';
import { AuthPopup } from '../../app/auth/components/auth-popup';

const MEDIA_URL =  process.env.NEXT_PUBLIC_MEDIA_API_URL || "";

export default function FreeGroupsPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuth();

  // All group/instructor conversations
  const [conversations, setConversations] = useState<any[] | null>(null);
  const [loadingConvos, setLoadingConvos] = useState(false);

  // Initial (last) conversation details:
  const [initialInsId, setInitialInsId] = useState<string | null>(null);
  const [initialName, setInitialName] = useState<string>('');
  const [initialAvatar, setInitialAvatar] = useState<string>('');
  const [initialProfession, setInitialProfession] = useState<string>('');
  const [initialMessages, setInitialMessages] = useState<any[]>([]);
  const [loadingMsgs, setLoadingMsgs] = useState(false);

  // Auth‑popup
  const [authMode, setAuthMode] = useState<'login' | 'signup' | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // -- 1) If NOT authenticated, immediately open login modal --
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      setAuthMode('login');
      setIsDialogOpen(true);
    }
  }, [isLoading, isAuthenticated]);

  // -- 2) Once signed in, fetch all conversations --
  useEffect(() => {
    if (!isAuthenticated) return;
    setLoadingConvos(true);
    fetchConversations()
      .then((convos) => setConversations(convos))
      .catch((err) => {
        console.error(err);
        setConversations([]);
      })
      .finally(() => setLoadingConvos(false));
  }, [isAuthenticated]);

  //prevent zoom
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

  // -- 3) Once we have conversations, pick the **last** one and fetch its messages --
  useEffect(() => {
    if (!conversations || conversations.length === 0) return;
    const last = conversations[0];
    setInitialInsId(last.instructorId);
    setInitialName(last.name);
    setInitialAvatar(
        `${process.env.NEXT_PUBLIC_MEDIA_BASE || MEDIA_URL}/media/image?key=${encodeURIComponent(last.pictureId)  || undefined}` 
    );
    setInitialProfession(last.profession || '');

    setLoadingMsgs(true);
    fetchMessages(last.instructorId)
      .then(setInitialMessages)
      .catch(console.error)
      .finally(() => setLoadingMsgs(false));
  }, [conversations]);

  // -- A) While auth is still determining, show spinner --
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <span className="text-gray-500">Checking authentication…</span>
      </div>
    );
  }
  

  // -- B) If NOT authenticated, show login/signup modal --
  if (!isAuthenticated) {
    return (
      <div className="h-screen">
        <p className='text-center text-lg font-bold text-primary mt-2'>Login to see chat!</p>
        <AuthPopup
          authMode={authMode}
          setAuthMode={setAuthMode}
          isOpen={isDialogOpen}
          onClose={() => setIsDialogOpen(false)}
        />
      </div>
    );
  }

  // -- C) Authenticated but still loading conversations --
  if (loadingConvos || conversations === null) {
    return (
      <div className="flex items-center justify-center h-screen">
        <span className="text-gray-500">Loading free groups…</span>
      </div>
    );
  }

  // -- D) Authenticated but no conversations --
  if (conversations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-screen space-y-4">
        <p className="text-gray-600 text-lg">You have no conversations yet.</p>
        <button
          onClick={() => router.back()}
          className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary-dark"
        >
          Back
        </button>
      </div>
    );
  }

  // -- E) Authenticated + have conversations + loaded first thread → render chats --
  return (
    <SocketProvider>
      {/* Mobile */}
      <div className="block md:hidden">
        <MobileChat
          insId={initialInsId!}
          instructorName={initialName}
          instructorAvatarUrl={initialAvatar}
          initialMessages={initialMessages}
          instructorProfession={initialProfession}
          chats={conversations}
        />
      </div>
      {/* Desktop */}
      <div className="hidden md:block">
        <DesktopChat
          insId={initialInsId!}
          instructorName={initialName}
          instructorAvatarUrl={initialAvatar}
          initialMessages={initialMessages}
          instructorProfession={initialProfession}
          chats={conversations}
        />
      </div>
    </SocketProvider>
  );
}
