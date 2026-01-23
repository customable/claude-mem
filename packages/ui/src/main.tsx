import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { BackendReadyProvider } from './providers/BackendReadyProvider';
import './styles/app.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BackendReadyProvider>
      <App />
    </BackendReadyProvider>
  </StrictMode>
);
