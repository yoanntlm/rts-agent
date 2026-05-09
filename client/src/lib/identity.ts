// Lightweight identity stored in localStorage. No auth — just a name + color.

const NAME_KEY = "rts.userName";
const COLOR_KEY = "rts.userColor";

const COLORS = [
  "#F97066", "#FDB022", "#FACC15", "#84CC16", "#22D3EE",
  "#60A5FA", "#A78BFA", "#F472B6", "#FB7185", "#34D399",
];

const ANIMALS = [
  "Otter", "Falcon", "Mantis", "Ibex", "Marten",
  "Lynx", "Heron", "Caiman", "Vole", "Tapir",
];

function randomFrom<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

export function getOrCreateIdentity(): { name: string; color: string } {
  let name = localStorage.getItem(NAME_KEY);
  let color = localStorage.getItem(COLOR_KEY);
  if (!name) {
    name = `${randomFrom(ANIMALS)}-${Math.floor(Math.random() * 100)}`;
    localStorage.setItem(NAME_KEY, name);
  }
  if (!color) {
    color = randomFrom(COLORS);
    localStorage.setItem(COLOR_KEY, color);
  }
  return { name, color };
}

export function setIdentityName(name: string) {
  localStorage.setItem(NAME_KEY, name);
}
