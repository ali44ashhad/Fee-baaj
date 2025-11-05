// src/components/Layout/Layout.tsx
import { ReactNode } from 'react';
import AppSidebar from '@/components/Layout/Sidebar';
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { useLocation } from 'react-router-dom';

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const location = useLocation();
  const isChat = location.pathname.includes('/chat');

  return (
    <SidebarProvider>
      {!isChat && <AppSidebar />}
      <SidebarInset>
        {!isChat && (
          <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-12">
            <div className="flex items-center gap-2 px-4">
              <SidebarTrigger className="-ml-1" />
            </div>
          </header>
        )}
        <main
          className={
            !isChat
              ? 'p-6 flex-1 flex flex-col overflow-auto container mx-auto'
              : 'flex-1 flex flex-col overflow-auto'
          }
        >
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
