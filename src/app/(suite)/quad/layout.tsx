import type { ReactNode } from "react";
import { ProductLayout, type NavItem } from "@/components/shell/ProductLayout";
import { listMySpaces, openReportCount } from "@/lib/quad/spaces";
import { getViewer } from "@/lib/viewer";
import { QuadRealtimeProvider } from "./_components/realtime";
import { SidebarSpaces } from "./_components/SpaceList";

export default async function QuadLayout({ children }: { children: ReactNode }) {
  const viewer = await getViewer();
  const spaces = listMySpaces(viewer);
  const unreadDms = spaces.filter((s) => s.kind === "direct").reduce((n, s) => n + s.unread, 0);

  const nav: NavItem[] = [
    { href: "/quad", label: "Home", icon: "home", exact: true },
    { href: "/quad/dm", label: "Direct messages", icon: "mail", count: unreadDms },
    ...(viewer.role === "student" ? [] : [{ href: "/quad/browse", label: "Browse groups", icon: "people" } as NavItem]),
    { href: "/quad/search", label: "Search", icon: "search" },
  ];
  if (viewer.isStaff) {
    nav.push({ href: "/quad/moderation", label: "Moderation", icon: "shield", count: openReportCount(viewer.schoolId) });
  }

  return (
    <QuadRealtimeProvider viewerId={viewer.id}>
      <ProductLayout product="quad" nav={nav} aside={<SidebarSpaces spaces={spaces} />} wide>
        {children}
      </ProductLayout>
    </QuadRealtimeProvider>
  );
}
