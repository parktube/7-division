// Log what electron returns
const electron = require('electron');
console.log('electron type:', typeof electron);
console.log('electron value:', electron);

// Try to access properties
if (electron && typeof electron === 'object') {
  console.log('Keys:', Object.keys(electron));
}
