import "@testing-library/jest-dom/vitest";

if (typeof globalThis.PointerEvent === "undefined") {
  class PointerEventShim extends MouseEvent {}
  globalThis.PointerEvent = PointerEventShim as typeof PointerEvent;
}
