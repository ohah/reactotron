import { ipcMain } from "electron"

const fs = require('node:fs')

export const fsInit = () => {
  ipcMain.on('fs-readFile-sync', (event, args) => {
    event.returnValue = fs.readFileSync(args.path, args.encoding)
  });
  ipcMain.on('fs-writeFile-sync', (event, args) => {
    event.returnValue = fs.writeFileSync(args.path, args.data, args.encoding)
  });
  ipcMain.on('fs-readFile', (event, args) => {
    fs.readFile(args.path, args.encoding, (err, data) => {
      event.reply(args.responseChannel, err, data)
    })
  })
}