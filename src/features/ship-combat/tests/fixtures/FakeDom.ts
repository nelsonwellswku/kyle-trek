export type FakeEventHandler = (event: Event) => void;

export class FakeElement {
  innerHTML = '';
  textContent = '';
  hidden = false;
  disabled = false;
  readonly attributes = new Map<string, string>();
  readonly listeners = new Map<string, Set<FakeEventHandler>>();
  readonly descendants = new Map<string, FakeElement>();

  constructor(initializeSelectors = true) {
    if (!initializeSelectors) return;
    for (const selector of [
      '#turn-status',
      '#active-turn',
      '#battle-result',
      '#battle-winner',
      '#ship-1-agility',
      '#ship-1-agility-modifier',
      '#ship-1-strength',
      '#ship-1-strength-modifier',
      '#ship-1-constitution',
      '#ship-1-constitution-modifier',
      '#ship-1-identity',
      '#ship-1-owner',
      '#ship-1-hit-points',
      '#ship-1-armor-class',
      '#ship-2-agility',
      '#ship-2-agility-modifier',
      '#ship-2-strength',
      '#ship-2-strength-modifier',
      '#ship-2-constitution',
      '#ship-2-constitution-modifier',
      '#ship-2-identity',
      '#ship-2-owner',
      '#ship-2-hit-points',
      '#ship-2-armor-class',
      'button.skip-movement-button',
      'button.end-turn-button',
      'button.new-game-button',
    ]) {
      this.descendants.set(selector, new FakeElementLeaf());
    }
  }

  querySelector<T extends Element = Element>(selector: string): T | null {
    return (this.descendants.get(selector) as unknown as T | undefined) ?? null;
  }

  setAttribute(name: string, value: string): void {
    this.attributes.set(name, value);
  }

  addEventListener(type: string, listener: EventListenerOrEventListenerObject): void {
    const handlers = this.listeners.get(type) ?? new Set<FakeEventHandler>();
    handlers.add(
      typeof listener === 'function' ? listener : (event) => listener.handleEvent(event),
    );
    this.listeners.set(type, handlers);
  }

  removeEventListener(type: string, listener: EventListenerOrEventListenerObject): void {
    const handlers = this.listeners.get(type);
    if (handlers && typeof listener === 'function') handlers.delete(listener);
  }

  replaceChildren(): void {
    this.descendants.clear();
    this.innerHTML = '';
  }

  click(): void {
    if (this.disabled || this.hidden) return;
    for (const handler of this.listeners.get('click') ?? []) handler(new Event('click'));
  }
}

class FakeElementLeaf extends FakeElement {
  constructor() {
    super(false);
  }
}
