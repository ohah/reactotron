import React, { FunctionComponent, useContext } from "react"
import TimelineContext from "../contexts/Timeline"

export interface TimelineCommandPropsEx<T> {
  command: {
    clientId?: string
    connectionId: number
    date: Date
    deltaTime: number
    important: boolean
    messageId: number
    payload: T
    type: string
  }
  copyToClipboard?: (text: string) => void
  readFile?: (path: string) => Promise<string>
  sendCommand?: (type: string, payload: any, clientId?: string) => void
  openDispatchDialog?: (action: string) => void
  dispatchAction?: (action: any) => void
  onExpandChange?: (messageId: number, isOpen: boolean) => void
}

export interface TimelineCommandProps<T> extends TimelineCommandPropsEx<T> {
  isOpen: boolean
  setIsOpen: (isOpen: boolean) => void
}

export function buildTimelineCommand<T>(
  Component: FunctionComponent<TimelineCommandProps<T>>
) {
  // eslint-disable-next-line react/display-name
  return (props: TimelineCommandPropsEx<T>) => {
    const { toggleItemExpanded, isItemExpanded } = useContext(TimelineContext)
    const messageId = props.command.messageId.toString()
    const isOpen = isItemExpanded(messageId)

    const handleSetIsOpen = (newIsOpen: boolean) => {
      toggleItemExpanded(messageId)
      if (props.onExpandChange) {
        props.onExpandChange(props.command.messageId, newIsOpen)
      }
    }

    return <Component {...props} isOpen={isOpen} setIsOpen={handleSetIsOpen} />
  }
}
