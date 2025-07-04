import React, { useCallback, useContext, useMemo } from "react"
import * as path from '@tauri-apps/api/path';
import { writeText } from '@tauri-apps/plugin-clipboard-manager';
import debounce from "lodash.debounce"
import {
  Header,
  filterCommands,
  TimelineFilterModal,
  timelineCommandResolver,
  EmptyState,
  ReactotronContext,
  TimelineContext,
  VirtualizedTimeline,
  RandomJoke,
} from "reactotron-core-ui"
import {
  MdSearch,
  MdDeleteSweep,
  MdFilterList,
  MdSwapVert,
  MdReorder,
  MdDownload,
} from "react-icons/md"
import { FaTimes } from "react-icons/fa"
import styled from "styled-components"
import { openUrl } from '@tauri-apps/plugin-opener';
import { readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";

const Container = styled.div`
  display: flex;
  flex-direction: column;
  width: 100%;
`
const TimelineContainer = styled.div`
  height: 100%;
  overflow-y: auto;
  overflow-x: hidden;
`
const SearchContainer = styled.div`
  display: flex;
  align-items: center;
  padding-bottom: 10px;
  padding-top: 4px;
  padding-right: 10px;
`
const SearchLabel = styled.p`
  padding: 0 10px;
  font-size: 14px;
  color: ${(props) => props.theme.foregroundDark};
`
const SearchInput = styled.input`
  border-radius: 4px;
  padding: 10px;
  flex: 1;
  background-color: ${(props) => props.theme.backgroundSubtleDark};
  border: none;
  color: ${(props) => props.theme.foregroundDark};
  font-size: 14px;
`
const HelpMessage = styled.div`
  margin: 0 40px;
`
const QuickStartButtonContainer = styled.div`
  display: flex;
  padding: 4px 8px;
  margin: 30px 20px;
  border-radius: 4px;
  cursor: pointer;
  background-color: ${(props) => props.theme.backgroundLighter};
  color: ${(props) => props.theme.foreground};
  align-items: center;
  justify-content: center;
  text-align: center;
`
const Divider = styled.div`
  height: 1px;
  background-color: ${(props) => props.theme.foregroundDark};
  margin: 40px 10px;
`

export const ButtonContainer = styled.div`
  padding: 10px;
  cursor: pointer;
`

function Timeline() {
  const { sendCommand, clearCommands, commands, openDispatchModal } = useContext(ReactotronContext)
  const {
    isSearchOpen,
    toggleSearch,
    closeSearch,
    setSearch,
    search,
    exclude,
    setExclude,
    isReversed,
    toggleReverse,
    openFilter,
    closeFilter,
    isFilterOpen,
    hiddenCommands,
    setHiddenCommands,
  } = useContext(TimelineContext)

  const renderCommandItem = useCallback((command: any) => {
    const CommandComponent = timelineCommandResolver(command.type)
    if (CommandComponent) {
      return (
        <CommandComponent
          key={command.messageId}
          command={command}
          copyToClipboard={writeText}
          readFile={async (filePath) => {
            try {
              const data = await readTextFile(filePath)
              return data
            } catch (err) {
              throw new Error("Something failed")
            }
          }}
          sendCommand={sendCommand}
          dispatchAction={(action: unknown) => {
            sendCommand("state.action.dispatch", { action })
          }}
          openDispatchDialog={openDispatchModal}
        />
      )
    }
    return null
  }, [writeText, readTextFile, sendCommand, openDispatchModal])

  let filteredCommands: unknown[] = []
  try {
    filteredCommands = filterCommands(commands || [], search, exclude, hiddenCommands || []) || []
  } catch (error) {
    console.error(error)
    filteredCommands = commands || []
  }

  if (isReversed) {
    filteredCommands = filteredCommands.reverse()
  }



  function openDocs() {
    openUrl("https://docs.infinite.red/reactotron/quick-start/react-native/")
  }

  async function downloadLog() {
    const homeDir = await path.homeDir();
    const downloadDir = await path.join(homeDir, "Downloads")
    const filePath = await path.join(downloadDir, `timeline-log-${Date.now()}.json`)  
    await writeTextFile(filePath, JSON.stringify(commands || []))
    console.log(`Exported timeline log to ${downloadDir}`)
  }

  const { searchString, handleInputChange } = useDebouncedSearchInput(search, setSearch, 300)
  const { searchString: excludeString, handleInputChange: handleExcludeInputChange } = useDebouncedSearchInput(exclude, setExclude, 300)

  return (
    <Container>
      <Header
        title="Timeline"
        isDraggable
        actions={[
          {
            tip: "Export Log",
            icon: MdDownload,
            onClick: () => {
              downloadLog()
            },
          },
          {
            tip: "Search",
            icon: MdSearch,
            onClick: () => {
              toggleSearch()
            },
          },
          {
            tip: "Filter",
            icon: MdFilterList,
            onClick: () => {
              openFilter()
            },
          },
          {
            tip: "Reverse Order",
            icon: MdSwapVert,
            onClick: () => {
              toggleReverse()
            },
          },
          {
            tip: "Clear",
            icon: MdDeleteSweep,
            onClick: () => {
              clearCommands()
            },
          },
        ]}
      >
        {isSearchOpen && (
          <SearchContainer>
            <SearchLabel>Search</SearchLabel>
            <SearchInput autoFocus value={searchString} onChange={handleInputChange} />
            <SearchLabel>Exclude</SearchLabel>
            <SearchInput value={excludeString} onChange={handleExcludeInputChange} />
            <ButtonContainer
              onClick={() => {
                if (search === "" && exclude === "") {
                  closeSearch()
                } else {
                  setSearch("")
                  setExclude("")
                }
              }}
            >
              <FaTimes size={24} />
            </ButtonContainer>
          </SearchContainer>
        )}
      </Header>
      <TimelineContainer>
        {filteredCommands.length === 0 ? (
          <EmptyState icon={MdReorder} title="No Activity">
            <HelpMessage>
              Once your app connects and starts sending events, they will appear here.
            </HelpMessage>
            <QuickStartButtonContainer onClick={openDocs}>
              Check out the quick start guide here!
            </QuickStartButtonContainer>
            <Divider />
            <RandomJoke />
          </EmptyState>
        ) : (
          <VirtualizedTimeline
            items={filteredCommands}
            itemHeight={55}
            renderItem={renderCommandItem}
            overscan={10}
          />
        )}
      </TimelineContainer>
      <TimelineFilterModal
        isOpen={isFilterOpen}
        onClose={() => {
          closeFilter()
        }}
        hiddenCommands={hiddenCommands}
        setHiddenCommands={setHiddenCommands}
      />
    </Container>
  )
}

export default Timeline

const useDebouncedSearchInput = (
  initialValue: string,
  setSearch: ((search: string) => void) | null,
  delay: number = 300
) => {
  const [searchString, setSearchString] = React.useState<string>(initialValue)
  
  // Provide a fallback function if setSearch is null
  const safeSetSearch = useCallback((value: string) => {
    if (setSearch) {
      setSearch(value)
    }
  }, [setSearch])
  
  const debouncedOnChange = useMemo(() => debounce(safeSetSearch, delay), [delay, safeSetSearch])

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const { value } = e.target
      setSearchString(value)
      debouncedOnChange(value)
    },
    [debouncedOnChange]
  )

  return {
    searchString,
    handleInputChange,
  }
}
