import { App as AntdApp } from 'antd';
import { QueryClientProvider } from '@tanstack/react-query';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.tsx';
import './index.css';
import './i18n/i18n';
import { LanguageProvider } from './i18n/LanguageProvider';
import { queryClient } from './config/query';
import { AuthSessionProvider } from './modules/auth/context/AuthSessionProvider';

createRoot(document.getElementById('root')!).render(
  <LanguageProvider>
    <AntdApp>
      <QueryClientProvider client={queryClient}>
        <AuthSessionProvider>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </AuthSessionProvider>
      </QueryClientProvider>
    </AntdApp>
  </LanguageProvider>,
);
