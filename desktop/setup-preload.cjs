const { contextBridge, ipcRenderer } = require('electron')
contextBridge.exposeInMainWorld('setup', {
  subscribe: callback => {
    ipcRenderer.on('setup:state', (_event, state) => callback(state))
    ipcRenderer.send('setup:subscribe')
  },
  retry: () => ipcRenderer.send('setup:retry'),
  openLog: () => ipcRenderer.send('setup:log'),
})
