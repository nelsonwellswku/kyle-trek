import './app/styles.css';
import { createSuppliedSetup, GameApplication } from './app/GameApplication.js';

const root = document.querySelector<HTMLElement>('#app');

if (!root) {
  throw new Error('Application root #app was not found.');
}

const application = new GameApplication(root, createSuppliedSetup());

if (import.meta.hot) {
  import.meta.hot.dispose(() => application.dispose());
}
