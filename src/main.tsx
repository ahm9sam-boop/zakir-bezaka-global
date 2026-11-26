import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { ThemeProvider } from './contexts/ThemeContext';
import { LanguageProvider } from './contexts/LanguageContext';


// Attach the sign-in token to our own /api calls.
const nativeFetch = window.fetch.bind(window);
window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
  try {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    if (url.startsWith('/api/') && !url.startsWith('/api/auth/')) {
      let token = '';
      const adminTok = localStorage.getItem('zakir_admin_token') || '';
      const stu = JSON.parse(localStorage.getItem('zakir_current_student') || 'null');
      token = url.startsWith('/api/admin/') ? adminTok : (stu?.token || adminTok);
      if (token) {
        const headers = new Headers(init?.headers || (typeof input !== 'string' && !(input instanceof URL) ? input.headers : undefined));
        headers.set('Authorization', 'Bearer ' + token);
        return nativeFetch(input, { ...init, headers });
      }
    }
  } catch { /* fall through */ }
  return nativeFetch(input, init);
};

createRoot(document.getElementById('root')!).render(
  <ThemeProvider>
    <LanguageProvider>
      <App />
    </LanguageProvider>
  </ThemeProvider>
);
