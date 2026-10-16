export type FakeEventHandler = (event: Event) => void;

export class FakeElement {
  textContent = '';
  hidden = false;
  disabled = false;
  readonly dataset: Record<string, string> = {};
  readonly attributes = new Map<string, string>();
  readonly listeners = new Map<string, Set<FakeEventHandler>>();
  childrenWereReplaced = false;

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
    ['button.new-game-button', new FakeElement()],
    ['#game-board', new FakeElement()],
  ]);

  get innerHTML(): string {
    return this.markup;
  }

  set innerHTML(markup: string) {
    this.markup = markup;
    const button = this.elements.get('button.new-game-button');
    if (button) {
      button.disabled = /<button[^>]*\sdisabled(?:\s|>)/.test(markup);
    }
  }

  querySelector<T extends Element = Element>(selectors: string): T | null {
    return (this.elements.get(selectors) as unknown as T | undefined) ?? null;
  }

  element(selectors: string): FakeElement {
    const element = this.elements.get(selectors);
    if (!element) {
      throw new Error(`No fake DOM element registered for selector ${selectors}.`);
    }

    return element;
  }
}
