// Bridge between the app page and the main process. Only these functions are exposed.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('jssNative', {
  http: (req) => ipcRenderer.invoke('http', req),
  store: {
    load: () => ipcRenderer.invoke('store:load'),
    saveLeague: (id, json) => ipcRenderer.invoke('store:saveLeague', id, json),
    deleteLeague: (id) => ipcRenderer.invoke('store:deleteLeague', id),
    setActive: (id) => ipcRenderer.invoke('store:setActive', id)
  },
  settings: {
    load: () => ipcRenderer.invoke('settings:load'),
    save: (s) => ipcRenderer.invoke('settings:save', s)
  },
  media: {
    put: (key, buf, type) => ipcRenderer.invoke('media:put', key, buf, type),
    get: (key) => ipcRenderer.invoke('media:get', key),
    del: (key) => ipcRenderer.invoke('media:del', key)
  },
  readAppFile: (name) => ipcRenderer.invoke('app:readFile', name),
  openExternal: (url) => ipcRenderer.invoke('app:openExternal', url),
  openDataFolder: () => ipcRenderer.invoke('app:dataFolder')
});
