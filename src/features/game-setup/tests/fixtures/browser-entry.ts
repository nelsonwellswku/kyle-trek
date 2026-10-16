import { GameApplication } from '../../../../app/GameApplication.js';
import { BoardPosition } from '../../domain/BoardPosition.js';
import { GameSetup } from '../../domain/GameSetup.js';
import '../../../../app/styles.css';

const root = document.querySelector<HTMLElement>('#app');

if (!root) {
  throw new Error('Fixture application root #app was not found.');
}

const knownLayout = new GameSetup(
  { identity: 'ship-1', position: new BoardPosition(1, 1) },
  { identity: 'ship-2', position: new BoardPosition(10, 10) },
);
const application = new GameApplication(root, knownLayout);

if (import.meta.hot) {
  import.meta.hot.dispose(() => application.dispose());
}
