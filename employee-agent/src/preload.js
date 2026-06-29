const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("officeWatchAgent", {
  getState: () => ipcRenderer.invoke("agent:get-state"),

  login: (email, password) =>
    ipcRenderer.invoke("agent:login", {
      email,
      password,
    }),

  logout: () => ipcRenderer.invoke("agent:logout"),

  refresh: () => ipcRenderer.invoke("agent:refresh"),

  minimize: () => ipcRenderer.invoke("agent:minimize"),

  onStateChanged: (callback) => {
    const listener = (event, state) => callback(state);

    ipcRenderer.on("agent:state-changed", listener);

    return () => {
      ipcRenderer.removeListener("agent:state-changed", listener);
    };
  },
});