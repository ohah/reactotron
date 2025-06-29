// TODO: Name this better...
import React, { FunctionComponent, PropsWithChildren } from "react"
import type { Command } from "reactotron-core-contract"
import {
  ReactotronProvider,
  CustomCommandsProvider,
  ReactNativeProvider,
  TimelineProvider,
  StateProvider,
} from "reactotron-core-ui"

import KeybindHandler from "./KeybindHandler"

interface Props {
  commands: Command[]
  sendCommand: (type: string, payload: any, clientId?: string) => void
  clearCommands: () => void
  addCommandListener: (callback: (command: Command) => void) => void
}

/** Wrapper for Reactauri context providers */
const ReactauriBrain: FunctionComponent<PropsWithChildren<Props>> = ({
  commands,
  sendCommand,
  clearCommands,
  addCommandListener,
  children,
}) => {
  return (
    <ReactotronProvider
      commands={commands}
      sendCommand={sendCommand}
      clearCommands={clearCommands}
      addCommandListener={addCommandListener}
    >
      <TimelineProvider>
        <StateProvider>
          <CustomCommandsProvider>
            <ReactNativeProvider>
              <KeybindHandler>{children}</KeybindHandler>
            </ReactNativeProvider>
          </CustomCommandsProvider>
        </StateProvider>
      </TimelineProvider>
    </ReactotronProvider>
  )
}

export default ReactauriBrain
