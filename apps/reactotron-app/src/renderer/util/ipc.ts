export const ipcRenderer = window?.electron?.ipcRenderer;

export const ipcSend = (eventName: string, args: {}) => {
  try {
    window?.electron?.ipcRenderer?.send(eventName, args);
  } catch (error) {
    console.log(error);
  }
};

export const ipcOn = (eventName: string, args: {}) => {
  try {
    window?.electron?.ipcRenderer?.on(eventName, args);
  } catch (error) {
    console.log(error);
  }
};

export const ipcInvoke = async (eventName: string, args: {}) => {
  try {
    const res = await window?.electron?.ipcRenderer?.invoke(eventName, args);
    return res;
  } catch (error) {
    console.log(error);
    return error;
  }
};
