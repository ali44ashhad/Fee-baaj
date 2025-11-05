import * as React from 'react';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar';
import routes from '@/lib/routes';
import { Link } from 'react-router-dom';


export default function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {


  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader className="pt-3 pb-10">
        <a href="/" className="text-2xl font-bold flex items-center">
          <span className="text-3xl">ƒ</span>reebaj
        </a>
      </SidebarHeader>
      <SidebarContent>
        <SidebarMenu>
          {routes
            .filter((r) => r.icon)
            .map(({ key, title, path, icon }) => (
              <div key={key}>
                <SidebarMenuItem>
                  <SidebarMenuButton tooltip={title} asChild className="py-5">
                    <Link to={path}>
                      {icon}
                      <span>{title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </div>
            ))}
        </SidebarMenu>
      </SidebarContent>
      {/* <SidebarFooter>Footer</SidebarFooter> */}
      <SidebarRail />
    </Sidebar>
  );
}
