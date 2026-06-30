const { spawn } = require('child_process');
const http = require('http');

console.log('Starting Next.js development server...');

// Spawn Next.js Dev Server
const nextDev = spawn('npx', ['next', 'dev'], { 
  shell: true, 
  stdio: 'inherit' 
});

let isElectronStarted = false;

function checkReady() {
  if (isElectronStarted) return;

  http.get('http://localhost:3000', (res) => {
    if (res.statusCode === 200) {
      console.log('Next.js dev server is ready! Launching Electron...');
      isElectronStarted = true;
      
      const electron = spawn('npx', ['electron', '.'], { 
        shell: true, 
        stdio: 'inherit' 
      });

      electron.on('close', () => {
        console.log('Electron closed. Terminating Next.js server...');
        nextDev.kill();
        process.exit(0);
      });
    } else {
      setTimeout(checkReady, 500);
    }
  }).on('error', () => {
    setTimeout(checkReady, 500);
  });
}

// Initial delay to let the Next.js process boot
setTimeout(checkReady, 2000);
