const { app, ipcMain, BrowserWindow } = require('electron');
console.log('app:', typeof app);
console.log('ipcMain:', typeof ipcMain);
console.log('BrowserWindow:', typeof BrowserWindow);
app.whenReady().then(() => {
  console.log('App ready!');
  app.quit();
});
