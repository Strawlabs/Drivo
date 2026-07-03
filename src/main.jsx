import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

/*
  This is the entry point — the very first JS file that runs.
  createRoot() takes the <div id="root"> in index.html and hands it to React.
  StrictMode makes React extra noisy in development to catch bugs early.
*/
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
