import React, { FunctionComponent } from "react"

import type { CommandTypeKey } from "reactotron-core-contract"

import useTimeline from "./useTimeline"

interface Context {
  isSearchOpen: boolean
  toggleSearch: () => void
  openSearch: () => void
  closeSearch: () => void
  search: string
  setSearch: (search: string) => void
  exclude: string
  setExclude: (exclude: string) => void
  isFilterOpen: boolean
  openFilter: () => void
  closeFilter: () => void
  isReversed: boolean
  toggleReverse: () => void
  hiddenCommands: CommandTypeKey[]
  setHiddenCommands: (commandTypes: CommandTypeKey[]) => void
  toggleItemExpanded: (messageId: string) => void
  isItemExpanded: (messageId: string) => boolean
}

const TimelineContext = React.createContext<Context>({
  isSearchOpen: false,
  toggleSearch: null,
  openSearch: null,
  closeSearch: null,
  search: "",
  setSearch: null,
  exclude: "",
  setExclude: null,
  isFilterOpen: false,
  openFilter: null,
  closeFilter: null,
  isReversed: false,
  toggleReverse: null,
  hiddenCommands: [],
  setHiddenCommands: null,
  toggleItemExpanded: () => {},
  isItemExpanded: () => false,
})

const Provider: FunctionComponent<{ children: React.ReactNode }> = ({ children }) => {
  const {
    isSearchOpen,
    toggleSearch,
    openSearch,
    closeSearch,
    search,
    setSearch,
    exclude,
    setExclude,
    isFilterOpen,
    openFilter,
    closeFilter,
    isReversed,
    toggleReverse,
    hiddenCommands,
    setHiddenCommands,
    toggleItemExpanded,
    isItemExpanded,
  } = useTimeline()

  return (
    <TimelineContext.Provider
      value={{
        isSearchOpen,
        toggleSearch,
        openSearch,
        closeSearch,
        search,
        setSearch,
        exclude,
        setExclude,
        isFilterOpen,
        openFilter,
        closeFilter,
        isReversed,
        toggleReverse,
        hiddenCommands,
        setHiddenCommands,
        toggleItemExpanded,
        isItemExpanded,
      }}
    >
      {children}
    </TimelineContext.Provider>
  )
}

export default TimelineContext
export const TimelineProvider = Provider
