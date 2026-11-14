import L from 'leaflet';
import blueIconUrl from 'leaflet-color-markers/img/marker-icon-2x-blue.png';
import orangeIconUrl from 'leaflet-color-markers/img/marker-icon-2x-orange.png';
import redIconUrl from 'leaflet-color-markers/img/marker-icon-2x-red.png';
import greenIconUrl from 'leaflet-color-markers/img/marker-icon-2x-green.png';
import violetIconUrl from 'leaflet-color-markers/img/marker-icon-2x-violet.png';
import greyIconUrl from 'leaflet-color-markers/img/marker-icon-2x-grey.png';
import shadowUrl from 'leaflet-color-markers/img/marker-shadow.png';

// Rollup/production minification guard for Leaflet's default icon path resolution
if (L?.Icon?.Default?.prototype?._getIconUrl) {
  delete L.Icon.Default.prototype._getIconUrl;
}

const createColorMarker = (iconUrl) =>
  new L.Icon({
    iconUrl,
    shadowUrl,
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41],
  });

export const INCIDENT_TYPES = [
  {
    type: 'Flood',
    dotClass: 'bg-blue-500',
    badgeClass: 'border-blue-500/40 bg-blue-500/15 text-blue-700 dark:text-blue-300',
    icon: createColorMarker(blueIconUrl),
  },
  {
    type: 'Landslide',
    dotClass: 'bg-orange-500',
    badgeClass: 'border-orange-500/40 bg-orange-500/15 text-orange-700 dark:text-orange-300',
    icon: createColorMarker(orangeIconUrl),
  },
  {
    type: 'Fire',
    dotClass: 'bg-red-500',
    badgeClass: 'border-red-500/40 bg-red-500/15 text-red-700 dark:text-red-300',
    icon: createColorMarker(redIconUrl),
  },
  {
    type: 'Medical',
    dotClass: 'bg-emerald-500',
    badgeClass: 'border-emerald-500/40 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
    icon: createColorMarker(greenIconUrl),
  },
  {
    type: 'Rescue',
    dotClass: 'bg-purple-500',
    badgeClass: 'border-purple-500/40 bg-purple-500/15 text-purple-700 dark:text-purple-300',
    icon: createColorMarker(violetIconUrl),
  },
  {
    type: 'Other',
    dotClass: 'bg-neutral-500',
    badgeClass: 'border-neutral-500/40 bg-neutral-500/15 text-neutral-700 dark:text-neutral-300',
    icon: createColorMarker(greyIconUrl),
  },
];

export const ALL_INCIDENT_TYPE_NAMES = INCIDENT_TYPES.map((item) => item.type);

const INCIDENT_CONFIG_MAP = Object.fromEntries(
  INCIDENT_TYPES.map((item) => [item.type, item])
);

export const getIncidentConfig = (type) =>
  INCIDENT_CONFIG_MAP[type] || INCIDENT_CONFIG_MAP.Other;