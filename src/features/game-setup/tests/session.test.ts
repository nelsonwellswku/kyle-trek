import { describe, expect, it } from 'vitest';
import { GameSession } from '../domain/GameSession.js';
import { GameSetupFactory } from '../domain/GameSetupFactory.js';
import { ScriptedRandomSource } from './fixtures/ScriptedRandomSource.js';

describe('GameSession', () => {
  it('starts at revision 1, consumes a fresh pair on New Game, and retains state when observed', () => {
    const source = new ScriptedRandomSource([0.01, 0.21, 0.61, 0.91]);
    const session = new GameSession(new GameSetupFactory(source));

    expect(session.revision).toBe(1);
    expect(source.consumedDraws).toBe(2);
    expect(session.currentSetup.ship1.position).toMatchObject({ row: 1, column: 1 });
    expect(session.currentSetup.ship2.position).toMatchObject({ row: 9, column: 5 });

    const initialSetup = session.currentSetup;
    for (let observation = 0; observation < 20; observation += 1) {
      expect(session.currentSetup).toBe(initialSetup);
      expect(session.revision).toBe(1);
      expect(source.consumedDraws).toBe(2);
    }

    const replacement = session.newGame();

    expect(session.currentSetup).toBe(replacement);
    expect(session.revision).toBe(2);
    expect(source.consumedDraws).toBe(4);
    expect(replacement.ship1.position).toMatchObject({ row: 2, column: 3 });
    expect(replacement.ship2.position).toMatchObject({ row: 10, column: 9 });
  });

  it('increments the revision for identical consecutive layouts', () => {
    const source = new ScriptedRandomSource([0.01, 0.91, 0.01, 0.91]);
    const session = new GameSession(new GameSetupFactory(source));
    const initialSetup = session.currentSetup;

    const repeatedSetup = session.newGame();

    expect(repeatedSetup.ship1.position).toEqual(initialSetup.ship1.position);
    expect(repeatedSetup.ship2.position).toEqual(initialSetup.ship2.position);
    expect(session.revision).toBe(2);
    expect(source.consumedDraws).toBe(4);
  });

  it('retains the complete setup and revision after a failed replacement, then can recover', () => {
    const source = new ScriptedRandomSource([0.01, 0.91, 0.12, 0.25, 0.4, 1, 0.99, 0.99]);
    const session = new GameSession(new GameSetupFactory(source));
    const firstReplacement = session.newGame();
    const revisionBeforeFailure = session.revision;

    expect(() => session.newGame()).toThrow(RangeError);
    expect(session.currentSetup).toBe(firstReplacement);
    expect(session.revision).toBe(revisionBeforeFailure);
    expect(source.consumedDraws).toBe(6);

    const recoveredSetup = session.newGame();

    expect(session.currentSetup).toBe(recoveredSetup);
    expect(session.revision).toBe(revisionBeforeFailure + 1);
    expect(recoveredSetup.ship1.position).toMatchObject({ row: 2, column: 10 });
    expect(recoveredSetup.ship2.position).toMatchObject({ row: 10, column: 10 });
    expect(source.consumedDraws).toBe(8);
  });
});
