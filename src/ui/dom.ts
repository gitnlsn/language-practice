type Child = Node | string | null | undefined | false;
type Attrs = Record<string, unknown>;

/** Tiny hyperscript helper: h("button", { class: "x", onclick }, "Label") */
export function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Attrs = {}, ...children: Child[]) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2), v as EventListener);
    else if (k === "dataset") Object.assign(el.dataset, v);
    else if (k in el && typeof v !== "string") (el as any)[k] = v;
    else el.setAttribute(k, v === true ? "" : String(v));
  }
  for (const c of children) if (c != null && c !== false) el.append(c);
  return el;
}

/** Segmented control (radio-button group styled as pills). */
export function segmented<T extends string | number>(
  name: string,
  options: { value: T; label: string }[],
  value: T,
  onChange: (v: T) => void,
) {
  return h(
    "div",
    { class: "segmented", role: "radiogroup", "aria-label": name },
    ...options.map((o) =>
      h(
        "label",
        {},
        h("input", {
          type: "radio",
          name,
          value: String(o.value),
          checked: o.value === value,
          onchange: () => onChange(o.value),
        }),
        h("span", {}, o.label),
      ),
    ),
  );
}

export function select<T extends string | number>(
  label: string,
  options: { value: T; label: string }[],
  value: T,
  onChange: (v: T) => void,
) {
  const el = h(
    "select",
    { "aria-label": label, onchange: () => onChange(options[el.selectedIndex].value) },
    ...options.map((o) => h("option", { value: String(o.value), selected: o.value === value }, o.label)),
  );
  return el;
}

export const field = (label: string, control: Node) => h("div", { class: "field" }, h("span", { class: "field-label" }, label), control);

export const isTyping = (e: KeyboardEvent) =>
  e.target instanceof HTMLElement && e.target.closest("input, textarea, select, [contenteditable]") != null;
