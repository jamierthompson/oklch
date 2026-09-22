import { Copy, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";

import { MiniBar } from "@/components/MiniBar.tsx";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import type { Theme } from "@/lib/theme.ts";

export interface ThemeActions {
  onSelect: (id: string) => void;
  onNew: () => void;
  onRename: (id: string) => void;
  onDuplicate: (id: string) => void;
  /** Gone at once, no confirmation: undo brings it back. */
  onDelete: (id: string) => void;
}

function Row({
  theme,
  active,
  actions,
}: {
  theme: Theme;
  active: boolean;
  actions: ThemeActions;
}) {
  const { isMobile, setOpenMobile } = useSidebar();
  const pick = () => {
    actions.onSelect(theme.id);
    if (isMobile) setOpenMobile(false);
  };
  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        isActive={active}
        tooltip={theme.name}
        onClick={pick}
        aria-current={active ? "true" : undefined}
      >
        <MiniBar theme={theme} />
        <span>{theme.name}</span>
      </SidebarMenuButton>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <SidebarMenuAction
              showOnHover
              aria-label={`${theme.name} actions`}
            />
          }
        >
          <MoreHorizontal />
        </DropdownMenuTrigger>
        <DropdownMenuContent
          side={isMobile ? "bottom" : "right"}
          align="start"
          className="min-w-44"
        >
          <DropdownMenuItem onClick={() => actions.onRename(theme.id)}>
            <Pencil /> Rename
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => actions.onDuplicate(theme.id)}>
            <Copy /> Duplicate
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            onClick={() => actions.onDelete(theme.id)}
          >
            <Trash2 /> Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </SidebarMenuItem>
  );
}

/**
 * Every theme on this machine, in one list, each with a swatch bar and a
 * menu to rename, duplicate, or delete it. New themes come in at the top;
 * a duplicate lands directly below what it copies.
 */
export function ThemeSidebar({
  themes,
  current,
  actions,
}: {
  themes: readonly Theme[];
  current: string | null;
  actions: ThemeActions;
}) {
  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="flex-row items-center justify-between gap-2">
        <span className="truncate px-1 text-sm font-semibold group-data-[collapsible=icon]:hidden">
          Gridiron
        </span>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Add theme"
          title="Add theme"
          onClick={actions.onNew}
        >
          <Plus />
        </Button>
      </SidebarHeader>
      <SidebarContent>
        <nav aria-label="Theme list" className="contents">
          <SidebarGroup>
            <SidebarGroupContent>
              {themes.length === 0 ? (
                <p className="px-2 text-xs text-muted-foreground group-data-[collapsible=icon]:hidden">
                  None yet.
                </p>
              ) : (
                <SidebarMenu>
                  {themes.map((b) => (
                    <Row
                      key={b.id}
                      theme={b}
                      active={b.id === current}
                      actions={actions}
                    />
                  ))}
                </SidebarMenu>
              )}
            </SidebarGroupContent>
          </SidebarGroup>
        </nav>
      </SidebarContent>
    </Sidebar>
  );
}
