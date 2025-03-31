import * as ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { registerSW } from 'virtual:pwa-register'

// Register service worker with a simple refresh handler
registerSW({
  onNeedRefresh() {
    // When new content is available, we can ask the user to refresh
    console.log('New content available, please refresh.');
  },
  onOfflineReady() {
    console.log('App ready to work offline');
  },
});

// Use createRoot from the ReactDOM object
ReactDOM.createRoot(document.getElementById("root")!).render(<App />);
