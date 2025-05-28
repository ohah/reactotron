import { ipcMain } from "electron"

const os = require('node:os')

export const osInit = () => {
  ipcMain.on('os-homedir', (event) => {
    event.returnValue = os.homedir()
  });
  ipcMain.on('os-tmpdir', (event) => {
    event.returnValue = os.tmpdir()
  });
}