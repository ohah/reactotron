import React, { useContext, useMemo } from "react"
import styled from "styled-components"
import { MdStorage } from "react-icons/md"
import { JSONTree } from "react-json-tree"
import { EmptyState } from "reactotron-core-ui"

import StandaloneContext from "../../contexts/Standalone"

const Container = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
  background-color: ${(props) => props.theme.background};
`

const StorageList = styled.div`
  flex: 1;
  overflow-y: auto;
  background-color: ${(props) => props.theme.background};
  padding: 20px 30px;
`

function MMKV() {
  const { selectedConnection } = useContext(StandaloneContext)

  const storageItems = useMemo(() => {
    if (!selectedConnection?.commands) return {}

    const storageObject: Record<string, string> = {}

    const mmkvCommands = selectedConnection.commands.filter(
      (command) => command.type === "display" && command.payload.name === "MMKV"
    )

    for (const command of mmkvCommands) {
      const { value } = command.payload
      if (value && typeof value === "object" && "key" in value) {
        storageObject[value.key] = value.value.toString()
      }
    }

    return storageObject
  }, [selectedConnection?.commands])

  return (
    <Container>
      <StorageList>
        {Object.keys(storageItems).length === 0 ? (
          <EmptyState icon={MdStorage} title="No MMKV items found">
            No MMKV data has been captured yet. When you use MMKV in your app, the data will appear
            here.
          </EmptyState>
        ) : (
          <JSONTree
            data={storageItems}
            hideRoot
            theme={{
              base00: "transparent",
              base01: "transparent",
              base02: "transparent",
              base03: "#5f5a60",
              base04: "#838184",
              base05: "#a7a7a7",
              base06: "#c3c3c3",
              base07: "#ffffff",
              base08: "#cf6a4c",
              base09: "#cda869",
              base0A: "#f9ee98",
              base0B: "#8f9d6a",
              base0C: "#afc4db",
              base0D: "#7587a6",
              base0E: "#9b859d",
              base0F: "#9b703f",
            }}
            invertTheme={false}
            shouldExpandNodeInitially={() => true}
          />
        )}
      </StorageList>
    </Container>
  )
}

export default MMKV
