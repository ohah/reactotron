import { useCallback, useReducer } from "react"
import { produce } from "immer"

export enum ActionTypes {
  ServerStarted = "SERVER_STARTED",
  ServerStopped = "SERVER_STOPPED",
  AddConnection = "ADD_CONNECTION",
  RemoveConnection = "REMOVE_CONNECTION",
  ClearConnectionCommands = "CLEAR_CONNECTION_COMMANDS",
  CommandReceived = "COMMAND_RECEIVED",
  ChangeSelectedClientId = "CHANGE_SELECTED_CLIENT_ID",
  AddCommandHandler = "ADD_COMMAND_HANDLER",
  PortUnavailable = "PORT_UNAVAILABLE",
}

export type ServerStatus = "stopped" | "portUnavailable" | "started"

export interface ReactotronConnection {
  // Stuff shipped from core-server
  id: number
  clientId: string

  // TODO: Nullable maybe?
  platform: "ios" | "android" | "browser"
  name?: string
  platformVersion?: string
  osRelease?: string
  userAgent?: string
}

export interface Connection extends ReactotronConnection {
  // Stuff that reactotron adds
  commands: any[]
  connected: boolean
}

interface State {
  serverStatus: ServerStatus
  connections: Connection[]
  selectedClientId: string
  orphanedCommands: any[] // Command[]
  commandListeners: ((command: any) => void)[] // ((command: Command) => void)[]
}

type Action =
  | { type: ActionTypes.ServerStarted; payload: undefined }
  | { type: ActionTypes.ServerStopped; payload: undefined }
  | {
      type: ActionTypes.AddConnection | ActionTypes.RemoveConnection
      payload: ReactotronConnection
    }
  | { type: ActionTypes.ChangeSelectedClientId; payload: string }
  | { type: ActionTypes.CommandReceived; payload: any } // TODO: Type this better!
  | { type: ActionTypes.ClearConnectionCommands }
  | { type: ActionTypes.AddCommandHandler; payload: (command: any) => void }
  | { type: ActionTypes.PortUnavailable; payload: undefined }

// Session storage utility functions
const sessionStorage = {
  getConnectionState: () => {
    try {
      const stored = window.sessionStorage.getItem('reactotron-connection-state')
      return stored ? JSON.parse(stored) : { connections: [], selectedClientId: null }
    } catch (e) {
      console.error('Failed to read connection state from session storage:', e)
      return { connections: [], selectedClientId: null }
    }
  },

  saveConnectionState: (connections: any[], selectedClientId: string | null) => {
    try {
      const state = {
        connections: connections.map(conn => ({
          id: conn.id,
          clientId: conn.clientId,
          platform: conn.platform,
          name: conn.name,
          platformVersion: conn.platformVersion,
          osRelease: conn.osRelease,
          userAgent: conn.userAgent,
          connected: conn.connected
        })),
        selectedClientId,
        timestamp: Date.now()
      }
      
      window.sessionStorage.setItem('reactotron-connection-state', JSON.stringify(state))
    } catch (e) {
      console.error('Failed to save connection state to session storage:', e)
    }
  },

  saveConnectionEvent: (type: 'connectionEstablished' | 'disconnect', payload: any) => {
    try {
      const existingEvents = sessionStorage.getConnectionEvents()
      const newEvent = {
        type,
        payload,
        timestamp: Date.now()
      }
      
      existingEvents.push(newEvent)
      
      // Keep only the last 100 events to save memory
      if (existingEvents.length > 100) {
        existingEvents.splice(0, existingEvents.length - 100)
      }
      
      window.sessionStorage.setItem('reactotron-connection-events', JSON.stringify(existingEvents))
    } catch (e) {
      console.error('Failed to save connection event to session storage:', e)
    }
  },

  getConnectionEvents: () => {
    try {
      const stored = window.sessionStorage.getItem('reactotron-connection-events')
      return stored ? JSON.parse(stored) : []
    } catch (e) {
      console.error('Failed to read connection events from session storage:', e)
      return []
    }
  }
}

export function reducer(state: State, action: Action) {
  switch (action.type) {
    case ActionTypes.ServerStarted:
      return produce(state, (draftState) => {
        draftState.serverStatus = "started"
      })
    case ActionTypes.ServerStopped:
      return produce(state, (draftState) => {
        draftState.serverStatus = "stopped"
      })
    case ActionTypes.AddConnection: {
      const newState = produce(state, (draftState) => {
        let existingConnection = draftState.connections.find(
          (c) => c.clientId === action.payload.clientId
        )

        if (existingConnection) {
          existingConnection.connected = true
        } else {
          existingConnection = {
            ...action.payload,
            commands: [],
            connected: true,
          }

          draftState.connections.push(existingConnection)
        }

        if (draftState.orphanedCommands.length > 0) {
          // TODO: Make this better... filtering this list twice probably is a terrible idea.
          const orphanedCommands = draftState.orphanedCommands.filter(
            (oc) => oc.connectionId === action.payload.id
          )

          // TODO: Consider if we need to do a one time sort of these... just in case.
          existingConnection.commands.push(...orphanedCommands)

          draftState.orphanedCommands = draftState.orphanedCommands.filter(
            (oc) => oc.connectionId !== action.payload.id
          )
        }

        // TODO: Figure out if we can stop having these dumb commands so early. Make core client only send once we actually have a client ID!

        const filteredConnections = draftState.connections.filter((c) => c.connected)

        if (filteredConnections.length === 1) {
          draftState.selectedClientId = filteredConnections[0].clientId
        }

        // Change the server status to started if it wasn't already
        draftState.serverStatus = "started"
      })

      // Save state to session storage
      sessionStorage.saveConnectionState(newState.connections, newState.selectedClientId)
      // Save connection event
      sessionStorage.saveConnectionEvent('connectionEstablished', action.payload)

      return newState
    }

    case ActionTypes.RemoveConnection: {
      const updatedState = produce(state, (draftState) => {
        const existingConnection = draftState.connections.find(
          (c) => c.clientId === action.payload.clientId
        )

        if (!existingConnection) return

        existingConnection.connected = false

        if (draftState.selectedClientId === action.payload.clientId) {
          const filteredConnections = draftState.connections.filter((c) => c.connected)

          if (filteredConnections.length > 0) {
            draftState.selectedClientId = filteredConnections[0].clientId
          } else {
            draftState.selectedClientId = null
          }
        }
      })

      // Save state to session storage
      sessionStorage.saveConnectionState(updatedState.connections, updatedState.selectedClientId)
      // Save disconnect event
      sessionStorage.saveConnectionEvent('disconnect', action.payload)

      return updatedState
    }

    case ActionTypes.CommandReceived:
      return produce(state, (draftState) => {
        if (!action.payload.clientId) {
          draftState.orphanedCommands.push(action.payload)
          return
        }

        const connection = draftState.connections.find(
          (c) => c.clientId === action.payload.clientId
        )

        if (!connection) {
          console.error("Command received for unknown connection:", action.payload)
          return
        }

        connection.commands = [action.payload, ...connection.commands]
      })
    case ActionTypes.ClearConnectionCommands:
      return produce(state, (draftState) => {
        if (!draftState.selectedClientId) return

        const selectedConnection = draftState.connections.find(
          (c) => c.clientId === draftState.selectedClientId
        )

        if (!selectedConnection) return

        selectedConnection.commands = []
      })
    case ActionTypes.ChangeSelectedClientId: {
      const selectedState = produce(state, (draftState) => {
        const selectedConnection = draftState.connections.find((c) => c.clientId === action.payload)

        if (!selectedConnection) return

        draftState.selectedClientId = action.payload
      })

      // Save state to session storage when selected client changes
      sessionStorage.saveConnectionState(selectedState.connections, selectedState.selectedClientId)

      return selectedState
    }

    case ActionTypes.AddCommandHandler:
      return produce(state, (draftState) => {
        draftState.commandListeners.push(action.payload)
      })
    case ActionTypes.PortUnavailable:
      return produce(state, (draftState) => {
        console.error("Port unavailable!")
        draftState.serverStatus = "portUnavailable"
      })
    default:
      return state
  }
}

function useStandalone() {
  // Get initial state from session storage
  const getInitialState = (): State => {
    try {
      const savedState = sessionStorage.getConnectionState()
      
      return {
        serverStatus: "stopped",
        connections: savedState.connections || [],
        selectedClientId: savedState.selectedClientId || null,
        orphanedCommands: [],
        commandListeners: [],
      }
    } catch (e) {
      console.error('Failed to initialize state from session storage:', e)
      return {
        serverStatus: "stopped",
        connections: [],
        selectedClientId: null,
        orphanedCommands: [],
        commandListeners: [],
      }
    }
  }

  const [state, dispatch] = useReducer(reducer, getInitialState())

  // Called when the server successfully starts
  const serverStarted = useCallback(() => {
    dispatch({ type: ActionTypes.ServerStarted, payload: undefined })
  }, [])

  // Called when the server stops
  const serverStopped = useCallback(() => {
    dispatch({ type: ActionTypes.ServerStopped, payload: undefined })
  }, [])

  // Called when we have client details. NOTE: Commands can start flying in before this gets called!
  const connectionEstablished = useCallback((connection: ReactotronConnection) => {
    dispatch({
      type: ActionTypes.AddConnection,
      payload: connection,
    })
  }, [])

  // Called when commands are flowing in.
  const commandReceived = useCallback(
    (command: any) => {
      // First dispatch to update state
      dispatch({ type: ActionTypes.CommandReceived, payload: command })

      // Then notify listeners
      state.commandListeners.forEach((cl) => cl(command))
    },
    [state.commandListeners]
  )

  // Called when a client disconnects. NOTE: They could be coming back. This could happen with a reload of the simulator!
  const connectionDisconnected = useCallback((connection: ReactotronConnection) => {
    dispatch({ type: ActionTypes.RemoveConnection, payload: connection })
  }, [])

  const clearSelectedConnectionCommands = useCallback(() => {
    dispatch({ type: ActionTypes.ClearConnectionCommands })
  }, [])

  const selectConnection = useCallback((clientId: string) => {
    dispatch({ type: ActionTypes.ChangeSelectedClientId, payload: clientId })
  }, [])

  const addCommandListener = useCallback((callback: (command: any) => void) => {
    dispatch({ type: ActionTypes.AddCommandHandler, payload: callback })
  }, [])

  const portUnavailable = useCallback(() => {
    dispatch({ type: ActionTypes.PortUnavailable, payload: undefined })
  }, [])

  return {
    ...state,
    selectedConnection: state.connections.find((c) => c.clientId === state.selectedClientId),
    selectConnection,
    serverStarted,
    serverStopped,
    connectionEstablished,
    connectionDisconnected,
    commandReceived,
    clearSelectedConnectionCommands,
    addCommandListener,
    portUnavailable,
  }
}

export default useStandalone
