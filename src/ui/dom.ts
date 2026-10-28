export type Handlers = Record<string, (el: HTMLElement, ev: MouseEvent) => void>;

/** Click delegation: elements with data-act="name" call handlers[name]. */
export function bind(root: HTMLElement, handlers: Handlers, onAny?: () => void): void {
  root.addEventListener('click', (ev) => {
    const target = (ev.target as HTMLElement).closest<HTMLElement>('[data-act]');
    if (!target || !root.contains(target)) return;
    if ((target as HTMLButtonElement).disabled) return;
    const fn = handlers[target.dataset.act!];
    if (!fn) return;
    ev.stopPropagation();
    onAny?.();
    fn(target, ev);
  });
}

export function el(html: string): HTMLElement {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild as HTMLElement;
}

export function qs<T extends HTMLElement = HTMLElement>(root: ParentNode, sel: string): T {
  return root.querySelector(sel) as T;
}
