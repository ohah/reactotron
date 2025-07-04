import { CommandType } from "reactotron-core-contract"
import type { CommandTypeKey } from "reactotron-core-contract"
import { escapeRegex } from "../escape-regex"

function path(...searchPath) {
  return (obj) => {
    let scaledObj = obj

    for (let i = 0; i < searchPath.length; i++) {
      scaledObj = scaledObj[searchPath[i]]

      if (typeof scaledObj === "undefined" || scaledObj === null) return null
    }

    return scaledObj
  }
}

const COMMON_MATCHING_PATHS = [
  path("type"),
  path("payload", "message"),
  path("payload", "preview"),
  path("payload", "name"),
  path("payload", "path"),
  path("payload", "triggerType"),
  path("payload", "description"),
  path("payload", "request", "url"),
  path("payload", "request", "data"),
]

export function filterSearch(commands: any[], search: string) {
  const trimmedSearch = (search || "").trim()

  if (trimmedSearch === "") return [...commands]

  const searchRegex = new RegExp(escapeRegex(trimmedSearch).replace(/\s/, "."), "i")

  const matching = (value: string) => {
    if (!value) {
      return false
    }

    if (typeof value === "string") {
      return searchRegex.test(value)
    } else {
      try {
        const stringifiedValue = JSON.stringify(value)
        return searchRegex.test(stringifiedValue)
      } catch (error) {
        // console.log("Error stringifying value", value, error)
        return false
      }
    }
  }

  return commands.filter(
    (command) =>
      COMMON_MATCHING_PATHS.filter((c) => {
        if (matching(c(command))) return true
        if (
          command.type === CommandType.Log &&
          (matching("debug") || matching("warning") || matching("error"))
        )
          return true
        if (command.type === CommandType.ClientIntro && matching("connection")) return true
        return false
      }).length > 0
  )
}

export function filterExclude(commands: any[], exclude: string) {
  const trimmedExclude = (exclude || "").trim()

  if (trimmedExclude === "") return [...commands]

  const excludeRegex = new RegExp(escapeRegex(trimmedExclude).replace(/\s/, "."), "i")

  const matching = (value: string) => {
    if (!value) {
      return false
    }

    if (typeof value === "string") {
      return excludeRegex.test(value)
    } else {
      try {
        const stringifiedValue = JSON.stringify(value)
        return excludeRegex.test(stringifiedValue)
      } catch (error) {
        // console.log("Error stringifying value", value, error)
        return false
      }
    }
  }

  return commands.filter(
    (command) =>
      COMMON_MATCHING_PATHS.filter((c) => {
        if (matching(c(command))) return true
        if (
          command.type === CommandType.Log &&
          (matching("debug") || matching("warning") || matching("error"))
        )
          return true
        if (command.type === CommandType.ClientIntro && matching("connection")) return true
        return false
      }).length === 0
  )
}

export function filterHidden(commands: any[], hiddenCommands: CommandTypeKey[]) {
  if (hiddenCommands.length === 0) return commands

  return commands.filter((command) => hiddenCommands.indexOf(command.type) === -1)
}

function filterCommands(commands: any[], search: string, exclude: string, hiddenCommands: CommandTypeKey[]) {
  const searchFilteredCommands = filterSearch(commands, search)
  const excludeFilteredCommands = filterExclude(searchFilteredCommands, exclude)
  return filterHidden(excludeFilteredCommands, hiddenCommands)
}

export default filterCommands
