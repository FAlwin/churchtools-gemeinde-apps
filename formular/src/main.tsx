import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { latoMitbringen } from '@ui/design/schrift';
import './main.scss';

// Schrift wie ChurchTools (#654) – das Formular läuft außerhalb von ChurchTools und bringt Lato selbst mit.
void latoMitbringen();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
