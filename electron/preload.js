const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  pickImage: () => ipcRenderer.invoke('pick-image'),
  getSavedPlaces: () => ipcRenderer.invoke('get-saved-places'),
  savePlace: (place) => ipcRenderer.invoke('save-place', place),
  removeSavedPlace: (placeId) => ipcRenderer.invoke('remove-saved-place', placeId),
  validateCookie: (cookie) => ipcRenderer.invoke('validate-cookie', cookie),
  tryAutoLogin: () => ipcRenderer.invoke('try-auto-login'),
  logout: () => ipcRenderer.invoke('logout'),
  getUniverseId: (placeId) => ipcRenderer.invoke('get-universe-id', placeId),
  listProducts: (universeId, pageToken) => ipcRenderer.invoke('list-products', universeId, pageToken),
  createProduct: (universeId, product) => ipcRenderer.invoke('create-product', universeId, product),
  updateProduct: (universeId, productId, fields) => ipcRenderer.invoke('update-product', universeId, productId, fields),
  bulkCreate: (universeId, products) => ipcRenderer.invoke('bulk-create', universeId, products),
  cancelBulk: () => ipcRenderer.invoke('cancel-bulk'),
  onBulkProgress: (callback) => {
    ipcRenderer.on('bulk-progress', (_, progress) => callback(progress));
    return () => ipcRenderer.removeAllListeners('bulk-progress');
  },
  onUpdateStatus: (callback) => {
    ipcRenderer.on('update-status', (_, status) => callback(status));
    return () => ipcRenderer.removeAllListeners('update-status');
  },
  downloadUpdate: () => ipcRenderer.invoke('download-update'),
  installUpdate: () => ipcRenderer.invoke('install-update'),
});
