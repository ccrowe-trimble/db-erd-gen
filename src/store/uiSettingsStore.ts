import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'

interface UISettingsState {
  showEdges: boolean
  setShowEdges: (v: boolean) => void
  highlightMode: 'dim' | 'hide'
  setHighlightMode: (v: 'dim' | 'hide') => void
  boxCompact: boolean
  setBoxCompact: (v: boolean) => void
  showDataTypes: boolean
  setShowDataTypes: (v: boolean) => void
}

const useUISettingsStore = create<UISettingsState>()(
  devtools(
    persist((set) => ({
      showEdges: true,
      setShowEdges: (v: boolean) => set({ showEdges: v }),
      highlightMode: 'dim',
      setHighlightMode: (v: 'dim' | 'hide') => set({ highlightMode: v }),
      boxCompact: false,
      setBoxCompact: (v: boolean) => set({ boxCompact: v }),
  showDataTypes: true,
  setShowDataTypes: (v: boolean) => set({ showDataTypes: v }),
      // reset to defaults
  resetUISettings: () => set({ showEdges: true, highlightMode: 'dim', boxCompact: false, showDataTypes: true })
    }), { name: 'ui-settings-storage' })
  )
)

export default useUISettingsStore;
