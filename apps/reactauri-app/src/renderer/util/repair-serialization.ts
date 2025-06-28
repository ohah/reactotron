/**
 * JSON.stringify() clobbers falsy values, so we had to "encode" those
 * values before that step on the client.
 *
 * This is the "decoding" part of that equation.
 *
 * Thanks Stack Overflow.
 *
 * https://stackoverflow.com/questions/30128834/deep-changing-values-in-a-javascript-object
 */

// on the server side, we'll be swapping out these values
const replacements: { [key: string]: unknown } = Object.create(null)
replacements["~~~ undefined ~~~"] = undefined
replacements["~~~ null ~~~"] = null
replacements["~~~ false ~~~"] = false
replacements["~~~ zero ~~~"] = 0
replacements["~~~ empty string ~~~"] = ""
replacements["~~~ anonymous function ~~~"] = "fn()"
replacements["~~~ NaN ~~~"] = Number.NaN
replacements["~~~ Infinity ~~~"] = Number.POSITIVE_INFINITY
replacements["~~~ -Infinity ~~~"] = Number.NEGATIVE_INFINITY

/**
 * Walks an object replacing any values with new values.  This mutates!
 *
 * @param payload The object
 * @return The same object with some values replaced.
 */
export default function repairSerialization(payload: any): any {
  // we only want objects
  if (typeof payload !== "object" || payload === null) {
    return payload
  }

  // the recursive iterator
  function walker(obj: Record<string, unknown>): void {
    let k: string
    // NOTE: Object.prototype.hasOwnProperty IS defined however the bind to the object throws the def off.
    const has = Object.prototype.hasOwnProperty.bind(obj) as (key: string) => boolean
    for (k in obj) {
      if (has(k)) {
        switch (typeof obj[k]) {
          // should we recurse thru sub-objects and arrays?
          case "object":
            if (obj[k] !== null) {
              walker(obj[k] as Record<string, unknown>)
            }
            break

          // mutate in-place with one of our replacements
          case "string":
            const strValue = obj[k] as string
            if (strValue.toLowerCase() in replacements) {
              // look for straight up replacements
              obj[k] = replacements[strValue.toLowerCase()]
            } else if (strValue.length > 9) {
              // fancy function replacements
              if (strValue.startsWith("~~~ ") && strValue.endsWith(" ~~~")) {
                obj[k] = strValue.replace(/~~~/g, "")
              }
            }
        }
        // Convert date values to Date objects
        if (k === 'date' && typeof obj[k] === 'string') {
          obj[k] = new Date(obj[k])
        }
      }
    }
  }

  // set it running
  walker(payload as Record<string, unknown>)

  // HACK - We should eventually make this function do less mutation
  return payload;
}
