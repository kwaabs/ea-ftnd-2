import { create } from "zustand"
import { persist } from "zustand/middleware"

interface SidebarState {
  isCollapsed: boolean
  openMenus: string[]
  toggleCollapsed: () => void
  toggleMenu: (menuId: string) => void
  closeAllMenus: () => void
}

export const useSidebarStore = create<SidebarState>()(
  persist(
    (set) => ({
      isCollapsed: false,
      openMenus: [],
      toggleCollapsed: () => set((state) => ({ isCollapsed: !state.isCollapsed })),
      toggleMenu: (menuId) =>
        set((state) => ({
          openMenus: state.openMenus.includes(menuId)
            ? state.openMenus.filter((id) => id !== menuId)
            : [...state.openMenus, menuId],
        })),
      closeAllMenus: () => set({ openMenus: [] }),
    }),
    {
      name: "sidebar-storage",
    },
  ),
)
