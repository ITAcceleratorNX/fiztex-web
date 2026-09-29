import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { AuthProvider } from '@/context/AuthContext';
import { ToastProvider } from '@/context/ToastContext';
import { App } from './App';
import { ADMIN_TITLE } from '@/lib/branding';
import './index.css';

// Keep the document title in sync with the branding constants.
document.title = ADMIN_TITLE;

function Root() {
  return (
    <AuthProvider>
      <ToastProvider>
        <App />
      </ToastProvider>
    </AuthProvider>
  );
}

// Data router enables route blockers for forms that must protect unsaved work.
const router = createBrowserRouter([{ path: '*', element: <Root /> }]);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
