import {
  contextBridge,
  ipcRenderer,
  shell,
  clipboard,
  nativeImage
} from 'electron';

contextBridge.exposeInMainWorld('electron', {
  ipcRenderer: {
    send: (eventName: string, args: []) => ipcRenderer.send(eventName, args),
    on: (eventName: string, args: (event: any, ...arg: any) => void) => ipcRenderer.on(eventName, args),
    invoke: (eventName: string, args: []) => ipcRenderer.invoke(eventName, args),
    // send: (channel, args) => includes(validChannels, channel) && ipcRenderer.send(channel, args),
    // on: (channel, args) => includes(validChannels, channel) && ipcRenderer.on(channel, args),
    // invoke: (channel, args) => includes(validChannels, channel) && ipcRenderer.invoke(channel, args),
  },
  shell,
  clipboard,
  nativeImage,
  // remote: {
  //   minimize: () => remote.BrowserWindow.getFocusedWindow().minimize(),
  //   isFullScreen: () => remote.BrowserWindow.getFocusedWindow().isFullScreen(),
  //   setFullScreen: (value: boolean) => remote.BrowserWindow.getFocusedWindow().setFullScreen(value),
  // },
});
