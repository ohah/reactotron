
export const ipcRenderer = window?.electron?.ipcRenderer

export const config = window?.config

export const clipboard = window?.electron?.clipboard

export const shell = window?.electron?.shell

export const nativeImage = window?.electron?.nativeImage

export const webFrame = window?.electron?.webFrame

export const fs = {
  readFile: (path: string, callback: (err: Error | null, data: Buffer) => void) => {
    const responseChannel = 'fs-read-file';
    window.electron.ipcRenderer.once(responseChannel, (event, err, data) => {
      callback(err, data);
    });
    window.electron.ipcRenderer.send('fs-read-file', path, responseChannel);
  },
  readFileSync: (path: string, encoding: string) => ipcRenderer.sendSync('fs-readFile-sync', { path, encoding }),
  writeFileSync: (path: string, data: string, encoding: string) => ipcRenderer.sendSync('fs-writeFile-sync', { path, data, encoding }),
}

export const os = {
  homedir: () => ipcRenderer.sendSync('os-homedir'),
  tmpdir: () => ipcRenderer.sendSync('os-tmpdir'),
}

export const path = {
  join: (...args: string[]) => ipcRenderer.sendSync('path-join', args),
  resolve: (...args: string[]) => ipcRenderer.sendSync('path-resolve', args),
}

