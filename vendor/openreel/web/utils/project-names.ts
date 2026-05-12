const CITY_NAMES = [
  "Studio", "Timeline", "Cut", "Scene", "Vault",
  "Trace", "Reel", "Render", "Sequence", "Canvas",
  "Frame", "Clip", "Export", "Preview", "Mix",
  "Grade", "Motion", "Layer", "Project", "Session",
];

const ADJECTIVES = [
  "Golden", "Velvet", "Circe", "Venus", "Ariadne",
  "Noir", "Lunar", "Radiant", "Violet", "Oracle",
  "Gilded", "Stellar", "Private", "Studio", "Cinematic",
];

export function generateProjectName(): string {
  const adjective = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const city = CITY_NAMES[Math.floor(Math.random() * CITY_NAMES.length)];
  return `${adjective} ${city}`;
}

export function generateSimpleProjectName(): string {
  return CITY_NAMES[Math.floor(Math.random() * CITY_NAMES.length)];
}
