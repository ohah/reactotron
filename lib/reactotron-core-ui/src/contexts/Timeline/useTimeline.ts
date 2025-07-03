import { useReducer, useEffect } from "react"

import type { CommandTypeKey } from "reactotron-core-contract"

export enum StorageKey {
  ReversedOrder = "ReactotronTimelineReversedOrder",
  HiddenCommands = "ReactotronTimelineHiddenCommands",
}

interface TimelineState {
  isSearchOpen: boolean
  search: string
  exclude: string
  isFilterOpen: boolean
  isReversed: boolean
  hiddenCommands: CommandTypeKey[]
  expandedItems: Set<string> // Use messageId as key
}

enum TimelineActionType {
  SearchOpen = "SEARCH_OPEN",
  SearchClose = "SEARCH_CLOSE",
  SearchSet = "SEARCH_SET",
  ExcludeSet = "EXCLUDE_SET",
  FilterOpen = "FILTER_OPEN",
  FilterClose = "FILTER_CLOSE",
  OrderReverse = "ORDER_REVERSE",
  OrderRegular = "ORDER_REGULAR",
  HiddenCommandsSet = "HIDDENCOMMANDS_SET",
  ItemExpand = "ITEM_EXPAND",
  ItemCollapse = "ITEM_COLLAPSE",
}

type Action =
  | {
      type:
        | TimelineActionType.SearchOpen
        | TimelineActionType.SearchClose
        | TimelineActionType.FilterOpen
        | TimelineActionType.FilterClose
        | TimelineActionType.OrderReverse
        | TimelineActionType.OrderRegular
    }
  | {
      type: TimelineActionType.SearchSet | TimelineActionType.ExcludeSet
      payload: string
    }
  | {
      type: TimelineActionType.HiddenCommandsSet
      payload: CommandTypeKey[]
    }
  | {
      type: TimelineActionType.ItemExpand | TimelineActionType.ItemCollapse
      payload: string // messageId
    }

function timelineReducer(state: TimelineState, action: Action) {
  switch (action.type) {
    case TimelineActionType.SearchOpen:
      return { ...state, isSearchOpen: true }
    case TimelineActionType.SearchClose:
      return { ...state, isSearchOpen: false }
    case TimelineActionType.SearchSet:
      return { ...state, search: action.payload }
    case TimelineActionType.ExcludeSet:
      return { ...state, exclude: action.payload }
    case TimelineActionType.FilterOpen:
      return { ...state, isFilterOpen: true }
    case TimelineActionType.FilterClose:
      return { ...state, isFilterOpen: false }
    case TimelineActionType.OrderReverse:
      return { ...state, isReversed: true }
    case TimelineActionType.OrderRegular:
      return { ...state, isReversed: false }
    case TimelineActionType.HiddenCommandsSet:
      return { ...state, hiddenCommands: action.payload }
    case TimelineActionType.ItemExpand: {
      const expandedSet = new Set(state.expandedItems)
      expandedSet.add(action.payload)
      return { ...state, expandedItems: expandedSet }
    }
    case TimelineActionType.ItemCollapse: {
      const newExpandedItems = new Set(state.expandedItems)
      newExpandedItems.delete(action.payload)
      return { ...state, expandedItems: newExpandedItems }
    }
    default:
      return state
  }
}

function useTimeline() {
  const [state, dispatch] = useReducer(timelineReducer, {
    isSearchOpen: false,
    search: "",
    exclude: "",
    isFilterOpen: false,
    isReversed: false,
    hiddenCommands: [],
    expandedItems: new Set<string>(),
  })

  // Load persisted values from localStorage
  useEffect(() => {
    const isReversed = localStorage.getItem(StorageKey.ReversedOrder) === "reversed"
    const hiddenCommands = JSON.parse(localStorage.getItem(StorageKey.HiddenCommands) || "[]")

    dispatch({
      type: isReversed ? TimelineActionType.OrderReverse : TimelineActionType.OrderRegular,
    })

    dispatch({
      type: TimelineActionType.HiddenCommandsSet,
      payload: hiddenCommands,
    })
  }, [])

  // Event handlers
  const toggleSearch = () => {
    dispatch({
      type: state.isSearchOpen ? TimelineActionType.SearchClose : TimelineActionType.SearchOpen,
    })
  }

  const openSearch = () => {
    dispatch({
      type: TimelineActionType.SearchOpen,
    })
  }

  const closeSearch = () => {
    dispatch({
      type: TimelineActionType.SearchClose,
    })
  }

  const setSearch = (search: string) => {
    dispatch({
      type: TimelineActionType.SearchSet,
      payload: search,
    })
  }

  const setExclude = (exclude: string) => {
    dispatch({
      type: TimelineActionType.ExcludeSet,
      payload: exclude,
    })
  }

  const openFilter = () => {
    dispatch({
      type: TimelineActionType.FilterOpen,
    })
  }

  const closeFilter = () => {
    dispatch({
      type: TimelineActionType.FilterClose,
    })
  }

  const toggleReverse = () => {
    const isReversed = !state.isReversed

    localStorage.setItem(StorageKey.ReversedOrder, isReversed ? "reversed" : "regular")

    dispatch({
      type: isReversed ? TimelineActionType.OrderReverse : TimelineActionType.OrderRegular,
    })
  }

  const setHiddenCommands = (hiddenCommands: CommandTypeKey[]) => {
    localStorage.setItem(StorageKey.HiddenCommands, JSON.stringify(hiddenCommands))

    dispatch({
      type: TimelineActionType.HiddenCommandsSet,
      payload: hiddenCommands,
    })
  }

  const toggleItemExpanded = (messageId: string) => {
    const isExpanded = state.expandedItems.has(messageId)
    
    if (isExpanded) {
      dispatch({ type: TimelineActionType.ItemCollapse, payload: messageId })
    } else {
      dispatch({ type: TimelineActionType.ItemExpand, payload: messageId })
    }
  }

  const isItemExpanded = (messageId: string) => state.expandedItems.has(messageId)

  return {
    isSearchOpen: state.isSearchOpen,
    toggleSearch,
    openSearch,
    closeSearch,
    search: state.search,
    setSearch,
    exclude: state.exclude,
    setExclude,
    isFilterOpen: state.isFilterOpen,
    openFilter,
    closeFilter,
    isReversed: state.isReversed,
    toggleReverse,
    hiddenCommands: state.hiddenCommands,
    setHiddenCommands,
    toggleItemExpanded,
    isItemExpanded,
  }
}

export default useTimeline
