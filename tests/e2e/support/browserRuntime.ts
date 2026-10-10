// Let Vite resolve the same versioned dependencies as the real components.
// Importing optimizer cache files directly can load a second React instance.
export { default as React } from 'react';
export { createRoot } from 'react-dom/client';
export { Form } from 'antd';
