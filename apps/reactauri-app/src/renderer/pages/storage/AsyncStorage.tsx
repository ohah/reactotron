import React, { useContext, useMemo } from "react"
import styled from "styled-components"
import { MdStorage } from "react-icons/md"
import { JSONTree } from "react-json-tree"
import { EmptyState } from "reactotron-core-ui"

import StandaloneContext from "../../contexts/Standalone"

const Container = styled.div`
  display: flex;
  flex-direction: column;
  flex: 1;
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

function AsyncStorage() {
  const { selectedConnection } = useContext(StandaloneContext)

  const storageItems = useMemo(() => {
    if (!selectedConnection?.commands) return {}

    const storageObject: Record<string, string> = {}
    const asyncStorageCommands = selectedConnection.commands.filter(
      (command) => command.type === "asyncStorage.mutation"
    )

    for (const command of asyncStorageCommands) {
      const { action, data } = command.payload

      switch (action) {
        case "setItem":
          storageObject[data.key] = data.value
          break
        case "removeItem":
          delete storageObject[data.key]
          break
        case "clear":
          for (const key of Object.keys(storageObject)) {
            delete storageObject[key]
          }
          break
        case "multiSet":
          for (const [key, value] of data.pairs || []) {
            storageObject[key] = value
          }
          break
        case "multiRemove":
          for (const key of data.keys || []) {
            delete storageObject[key]
          }
          break
      }
    }

    return storageObject
  }, [selectedConnection?.commands])

  return (
    <Container>
      <StorageList>
        {Object.keys(storageItems).length === 0 ? (
          <EmptyState icon={MdStorage} title="No AsyncStorage items found">
            No AsyncStorage data has been captured yet. When you use AsyncStorage in your app, the
            data will appear here.
          </EmptyState>
        ) : (
          <JSONTree
            hideRoot
            data={storageItems}
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

export default AsyncStorage
