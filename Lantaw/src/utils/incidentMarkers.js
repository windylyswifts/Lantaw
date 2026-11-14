import L from 'leaflet';

// Rollup/Rolldown production minification guard for Leaflet's default icon path resolution
if (L?.Icon?.Default?.prototype?._getIconUrl) {
  delete L.Icon.Default.prototype._getIconUrl;
}

const createPinIcon = (fillHex, strokeHex = '#ffffff') => {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 40" width="28" height="40">
      <path
        d="M14 1C7.37 1 2 6.37 2 13c0 9.25 12 25 12 25s12-15.75 12-25C26 6.37 20.63 1 14 1z"
        fill="${fillHex}"
        stroke="${strokeHex}"
        stroke-width="2"
      />
      <circle cx="14" cy="13" r="4.5" fill="#ffffff" />
    </svg>
  `.trim();

  return new L.Icon({
    iconUrl: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
    iconSize: [28, 40],
    iconAnchor: [14, 40],
    popupAnchor: [0, -36],
  });
};

export const INCIDENT_TYPES = [
  {
    type: 'Flood',
    dotClass: 'bg-blue-500',
    badgeClass: 'border-blue-500/40 bg-blue-500/15 text-blue-700 dark:text-blue-300',
    icon: createPinIcon('#3b82f6'),
  },
  {
    type: 'Landslide',
    dotClass: 'bg-orange-500',
    badgeClass: 'border-orange-500/40 bg-orange-500/15 text-orange-700 dark:text-orange-300',
    icon: createPinIcon('#f97316'),
  },
  {
    type: 'Fire',
    dotClass: 'bg-red-500',
    badgeClass: 'border-red-500/40 bg-red-500/15 text-red-700 dark:text-red-300',
    icon: createPinIcon('#ef4444'),
  },
  {
    type: 'Medical',
    dotClass: 'bg-emerald-500',
    badgeClass: 'border-emerald-500/40 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
    icon: createPinIcon('#10b981'),
  },
  {
    type: 'Rescue',
    dotClass: 'bg-purple-500',
    badgeClass: 'border-purple-500/40 bg-purple-500/15 text-purple-700 dark:text-purple-300',
    icon: createPinIcon('#a855f7'),
  },
  {
    type: 'Other',
    dotClass: 'bg-neutral-500',
    badgeClass: 'border-neutral-500/40 bg-neutral-500/15 text-neutral-700 dark:text-neutral-300',
    icon: createPinIcon('#6b7280'),
  },
];

export const ALL_INCIDENT_TYPE_NAMES = INCIDENT_TYPES.map((item) => item.type);

const INCIDENT_CONFIG_MAP = Object.fromEntries(
  INCIDENT_TYPES.map((item) => [item.type, item])
);

export const getIncidentConfig = (type) =>
  INCIDENT_CONFIG_MAP[type] || INCIDENT_CONFIG_MAP.Other;