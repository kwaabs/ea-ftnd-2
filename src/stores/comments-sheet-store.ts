import { create } from "zustand"

interface CommentsSheetState {
  isOpen: boolean
  open: () => void
  close: () => void
}

export const useCommentsSheetStore = create<CommentsSheetState>()((set) => ({
  isOpen: false,
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
}))
