export type FakeEventHandler = (event: Event) => void;

export class FakeElement {
  textContent = '';
  hidden = false;
  disabled = false;
  readonly dataset: Record<string, string> = {};
  readonly attributes = new Map<string, string>();
  readonly listeners = new Map<string, Set<FakeEventHandler>>();
  readonly descendants = new Map<string, FakeElement>();
  childrenWereReplaced = false;
  private childMarkup = '';

  constructor(initializeTurnControls = true) {
    if (initializeTurnControls) {
      this.descendants.set('#turn-status', new FakeElement(false));
      this.descendants.set('#active-turn', new FakeElement(false));
      this.descendants.set('#ship-1-agility', new FakeElement(false));
      this.descendants.set('#ship-1-modifier', new FakeElement(false));
      this.descendants.set('#ship-2-agility', new FakeElement(false));
      this.descendants.set('#ship-2-modifier', new FakeElement(false));
      this.descendants.set('button.pass-turn-button', new FakeElement(false));
    }
  }

  get innerHTML(): string {
    return this.childMarkup;
  }

  set innerHTML(markup: string) {
    this.childMarkup = markup;
    const passButton = this.descendants.get('button.pass-turn-button');
    if (passButton) {
      const buttonMarkup = markup.match(
        /<button[^>]*class=["'][^"']*pass-turn-button[^"']*["'][^>]*>/,
      )?.[0];
      passButton.disabled = buttonMarkup ? /\sdisabled(?:\s|>)/.test(buttonMarkup) : false;
      passButton.hidden = buttonMarkup ? /\shidden(?:\s|>)/.test(buttonMarkup) : true;
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
    if (!handlers) {
      return;
    }

    if (typeof listener === 'function') {
      handlers.delete(listener);
    }
  }

  replaceChildren(): void {
    this.childrenWereReplaced = true;
  }

  click(): void {
    if (this.disabled) {
      return;
    }

    for (const handler of this.listeners.get('click') ?? []) {
      handler(new Event('click'));
    }
  }
}

export class FakeRoot extends FakeElement {
  private markup = '';
  readonly elements = new Map<string, FakeElement>([
    ['#ship-1-position', new FakeElement()],
    ['#ship-2-position', new FakeElement()],
    ['[role="status"]', new FakeElement()],
    ['[role="alert"]', new FakeElement()],
    ['#movement-error', new FakeElement()],
    ['button.new-game-button', new FakeElement()],
    ['button.pass-turn-button', new FakeElement()],
    ['#turn-hud', new FakeElement()],
    ['#game-board', new FakeElement()],
  ]);

  override get innerHTML(): string {
    return this.markup;
  }

  override set innerHTML(markup: string) {
    this.markup = markup;
    const elements = new Map([...this.elements, ...this.descendants]);
    for (const [selector, button] of elements) {
      if (!selector.startsWith('button.')) {
        continue;
      }

      const className = selector.slice('button.'.length);
      const buttonMarkup = markup.match(
        new RegExp(`<button[^>]*class=["'][^"']*${className}[^"']*["'][^>]*>`),
      )?.[0];
      button.disabled = buttonMarkup ? /\sdisabled(?:\s|>)/.test(buttonMarkup) : false;
      button.hidden = buttonMarkup ? /\shidden(?:\s|>)/.test(buttonMarkup) : true;
    }
  }

  override querySelector<T extends Element = Element>(selectors: string): T | null {
    if (this.markup.includes('class="turn-controls"')) {
      return super.querySelector<T>(selectors);
    }

    const turnControl = this.elements.get('#turn-hud')?.querySelector<T>(selectors);
    return turnControl ?? (this.elements.get(selectors) as unknown as T | undefined) ?? null;
  }

  element(selectors: string): FakeElement {
    if (this.markup.includes('class="turn-controls"')) {
      const turnControl = super.querySelector(selectors);
      if (turnControl) {
        return turnControl as unknown as FakeElement;
      }
    }

    if (!this.markup.includes('class="turn-controls"')) {
      const turnControl = this.elements.get('#turn-hud')?.querySelector(selectors);
      if (turnControl) {
        return turnControl as unknown as FakeElement;
      }
    }

    const element = this.elements.get(selectors);
    if (!element) {
      const descendant = super.querySelector(selectors);
      if (descendant) {
        return descendant as unknown as FakeElement;
      }
      throw new Error(`No fake DOM element registered for selector ${selectors}.`);
    }

    return element;
  }
}
