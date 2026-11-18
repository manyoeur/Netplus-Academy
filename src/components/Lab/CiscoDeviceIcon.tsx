import React, { useId } from 'react';
import { SimDeviceType } from './networkSimTypes';

interface CiscoDeviceIconProps {
  type: SimDeviceType;
  className?: string;
  title?: string;
}

function sanitizeSvgIdPrefix(prefix: string): string {
  const cleaned = prefix.replace(/[^a-zA-Z0-9_-]/g, '_');
  return cleaned.length > 0 ? cleaned : 'nd';
}

/**
 * Generates crisp, self-contained modern enterprise networking hardware SVG inner markup
 * positioned inside a 64x56 coordinate box centered around (32, 28).
 *
 * Uses caller-scoped `uidPrefix` for all `<defs>` gradient IDs so multiple instances on the
 * same page or inside multi-device SVG/PNG exports never collide or lose fills on unmount.
 */
export function getCiscoDeviceInnerSvg(
  type: SimDeviceType,
  uidPrefix: string = 'nd'
): string {
  const p = sanitizeSvgIdPrefix(uidPrefix);

  switch (type) {
    case 'router':
      return `
        <defs>
          <linearGradient id="${p}_r_body" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stop-color="#0f294d" />
            <stop offset="28%" stop-color="#1d4ed8" />
            <stop offset="56%" stop-color="#2563eb" />
            <stop offset="82%" stop-color="#1e3a8a" />
            <stop offset="100%" stop-color="#0b1730" />
          </linearGradient>
          <linearGradient id="${p}_r_top" x1="12%" y1="0%" x2="88%" y2="100%">
            <stop offset="0%" stop-color="#38bdf8" />
            <stop offset="52%" stop-color="#0284c7" />
            <stop offset="100%" stop-color="#1e3a8a" />
          </linearGradient>
          <linearGradient id="${p}_r_bezel" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stop-color="#090f1d" />
            <stop offset="50%" stop-color="#0f172a" />
            <stop offset="100%" stop-color="#020617" />
          </linearGradient>
        </defs>

        <!-- Ground contact shadow -->
        <ellipse cx="32" cy="43.5" rx="23.5" ry="6.8" fill="#020617" fill-opacity="0.22" />

        <!-- Cylindrical Anodized Chassis -->
        <path
          d="M 7 20.5 L 7 35.5 A 25 10.5 0 0 0 57 35.5 L 57 20.5 Z"
          fill="url(#${p}_r_body)"
          stroke="#93c5fd"
          stroke-opacity="0.75"
          stroke-width="1.15"
          stroke-linejoin="round"
        />

        <!-- Front Dark Console / Status Telemetry Bay -->
        <path
          d="M 15.5 34.4 A 25 10.5 0 0 0 48.5 34.4 L 48.5 38.6 A 25 10.5 0 0 1 15.5 38.6 Z"
          fill="url(#${p}_r_bezel)"
          stroke="#38bdf8"
          stroke-opacity="0.35"
          stroke-width="0.6"
        />
        <!-- Micro Port Slots & Activity LEDs on Front Bay -->
        <rect x="20.5" y="37.4" width="3.6" height="2" rx="0.4" fill="#1e293b" stroke="#64748b" stroke-width="0.45" />
        <rect x="25.2" y="38.1" width="3.6" height="2" rx="0.4" fill="#1e293b" stroke="#64748b" stroke-width="0.45" />
        <circle cx="33" cy="39.3" r="1.05" fill="#10b981" />
        <circle cx="36.5" cy="39.1" r="1.05" fill="#38bdf8" />
        <circle cx="40" cy="38.6" r="0.9" fill="#f59e0b" />

        <!-- Top Elliptical Deck -->
        <ellipse
          cx="32"
          cy="20.5"
          rx="25"
          ry="10.5"
          fill="url(#${p}_r_top)"
          stroke="#bae6fd"
          stroke-width="1.15"
        />
        <!-- Crisp Inner Specular Bevel Ring -->
        <ellipse
          cx="32"
          cy="20.5"
          rx="22.8"
          ry="8.9"
          fill="none"
          stroke="#e0f2fe"
          stroke-opacity="0.32"
          stroke-width="0.65"
        />

        <!-- Subtle Shadow Layer for 4-Way Routing Arrows -->
        <g transform="translate(0, 0.75)" fill="#082f49" fill-opacity="0.55">
          <polygon points="17.5,15.4 20.6,13.9 26.8,16.7 28.6,15.6 29.6,19 22.9,18.7 24.7,17.8" />
          <polygon points="46.5,25.6 43.4,27.1 37.2,24.3 35.4,25.4 34.4,22 41.1,22.3 39.3,23.2" />
          <polygon points="34.2,19 36.4,20.1 42.5,17.2 44.3,18.1 45.5,14.7 38.8,15.1 40.5,16" />
          <polygon points="29.8,22 27.6,20.9 21.5,23.8 19.7,22.9 18.5,26.3 25.2,25.9 23.5,25" />
        </g>

        <!-- Luminous Modern 4-Way Routing Arrows -->
        <g fill="#f8fafc">
          <polygon points="17.5,15.4 20.6,13.9 26.8,16.7 28.6,15.6 29.6,19 22.9,18.7 24.7,17.8" />
          <polygon points="46.5,25.6 43.4,27.1 37.2,24.3 35.4,25.4 34.4,22 41.1,22.3 39.3,23.2" />
          <polygon points="34.2,19 36.4,20.1 42.5,17.2 44.3,18.1 45.5,14.7 38.8,15.1 40.5,16" />
          <polygon points="29.8,22 27.6,20.9 21.5,23.8 19.7,22.9 18.5,26.3 25.2,25.9 23.5,25" />
        </g>
      `;

    case 'switch':
      return `
        <defs>
          <linearGradient id="${p}_sw_top" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#38bdf8" />
            <stop offset="55%" stop-color="#0284c7" />
            <stop offset="100%" stop-color="#075985" />
          </linearGradient>
          <linearGradient id="${p}_sw_front" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#1e293b" />
            <stop offset="100%" stop-color="#090f1d" />
          </linearGradient>
          <linearGradient id="${p}_sw_side" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#0c4a6e" />
            <stop offset="100%" stop-color="#090f1d" />
          </linearGradient>
        </defs>

        <!-- Ground contact shadow -->
        <polygon points="8,43.5 47,43.5 59,29.5 21,29.5" fill="#020617" fill-opacity="0.2" />

        <!-- Top Isometric Deck -->
        <polygon
          points="19,12 58,12 46,27 6,27"
          fill="url(#${p}_sw_top)"
          stroke="#bae6fd"
          stroke-width="1.1"
          stroke-linejoin="round"
        />

        <!-- Gunmetal Front Rack Faceplate -->
        <polygon
          points="6,27 46,27 46,42 6,42"
          fill="url(#${p}_sw_front)"
          stroke="#94a3b8"
          stroke-opacity="0.85"
          stroke-width="1.1"
          stroke-linejoin="round"
        />

        <!-- Right Isometric Chassis Side -->
        <polygon
          points="46,27 58,12 58,27 46,42"
          fill="url(#${p}_sw_side)"
          stroke="#7dd3fc"
          stroke-opacity="0.7"
          stroke-width="1.1"
          stroke-linejoin="round"
        />

        <!-- Subtle Cyan Top Lip Highlight -->
        <line x1="6.8" y1="27" x2="45.6" y2="27" stroke="#e0f2fe" stroke-opacity="0.75" stroke-width="0.9" />

        <!-- Recessed RJ-45 Ethernet Port Bank (10/100/1000 Switch Ports) -->
        <rect x="8.5" y="30" width="25.5" height="9.2" rx="1" fill="#020617" stroke="#334155" stroke-width="0.65" />
        <!-- Row 1 Ports -->
        <rect x="10.2" y="31.3" width="3" height="2.4" rx="0.35" fill="#0f172a" stroke="#64748b" stroke-width="0.45" />
        <rect x="14.2" y="31.3" width="3" height="2.4" rx="0.35" fill="#0f172a" stroke="#64748b" stroke-width="0.45" />
        <rect x="18.2" y="31.3" width="3" height="2.4" rx="0.35" fill="#0f172a" stroke="#64748b" stroke-width="0.45" />
        <rect x="22.2" y="31.3" width="3" height="2.4" rx="0.35" fill="#0f172a" stroke="#64748b" stroke-width="0.45" />
        <rect x="26.2" y="31.3" width="3" height="2.4" rx="0.35" fill="#0f172a" stroke="#64748b" stroke-width="0.45" />
        <rect x="30.2" y="31.3" width="2.6" height="2.4" rx="0.35" fill="#0f172a" stroke="#64748b" stroke-width="0.45" />
        <!-- Row 2 Ports -->
        <rect x="10.2" y="35.3" width="3" height="2.4" rx="0.35" fill="#0f172a" stroke="#64748b" stroke-width="0.45" />
        <rect x="14.2" y="35.3" width="3" height="2.4" rx="0.35" fill="#0f172a" stroke="#64748b" stroke-width="0.45" />
        <rect x="18.2" y="35.3" width="3" height="2.4" rx="0.35" fill="#0f172a" stroke="#64748b" stroke-width="0.45" />
        <rect x="22.2" y="35.3" width="3" height="2.4" rx="0.35" fill="#0f172a" stroke="#64748b" stroke-width="0.45" />
        <rect x="26.2" y="35.3" width="3" height="2.4" rx="0.35" fill="#0f172a" stroke="#64748b" stroke-width="0.45" />
        <rect x="30.2" y="35.3" width="2.6" height="2.4" rx="0.35" fill="#0f172a" stroke="#64748b" stroke-width="0.45" />
        <!-- Active Port Link LEDs -->
        <circle cx="11.7" cy="30.7" r="0.6" fill="#10b981" />
        <circle cx="15.7" cy="30.7" r="0.6" fill="#10b981" />
        <circle cx="19.7" cy="30.7" r="0.6" fill="#38bdf8" />
        <circle cx="27.7" cy="30.7" r="0.6" fill="#10b981" />
        <circle cx="15.7" cy="38.3" r="0.6" fill="#f59e0b" />
        <circle cx="23.7" cy="38.3" r="0.6" fill="#10b981" />

        <!-- Dual SFP+ Fiber Uplink Cages + Status LEDs -->
        <rect x="36.2" y="30.2" width="3.3" height="8.8" rx="0.6" fill="#0f172a" stroke="#38bdf8" stroke-opacity="0.75" stroke-width="0.6" />
        <rect x="40.5" y="30.2" width="3.3" height="8.8" rx="0.6" fill="#0f172a" stroke="#38bdf8" stroke-opacity="0.75" stroke-width="0.6" />
        <circle cx="37.85" cy="31.7" r="0.65" fill="#10b981" />
        <circle cx="42.15" cy="31.7" r="0.65" fill="#22d3ee" />

        <!-- Side Rack Airflow Vents -->
        <line x1="48.5" y1="32" x2="55.5" y2="23" stroke="#38bdf8" stroke-opacity="0.35" stroke-width="0.9" stroke-linecap="round" />
        <line x1="48.5" y1="35.5" x2="55.5" y2="26.5" stroke="#38bdf8" stroke-opacity="0.35" stroke-width="0.9" stroke-linecap="round" />

        <!-- Shadow Layer for Bidirectional Switching Arrows -->
        <g transform="translate(0, 0.7)" fill="#082f49" fill-opacity="0.5">
          <polygon points="31.5,15.7 22.5,15.7 22.5,14.1 16.8,16.5 22.5,18.9 22.5,17.3 31.5,17.3" />
          <polygon points="36.2,15.7 44.5,15.7 44.5,14.1 50.2,16.5 44.5,18.9 44.5,17.3 36.2,17.3" />
          <polygon points="14.5,22 23.5,22 23.5,20.4 29.2,22.8 23.5,25.2 23.5,23.6 14.5,23.6" />
          <polygon points="46.2,22 37.8,22 37.8,20.4 32.1,22.8 37.8,25.2 37.8,23.6 46.2,23.6" />
        </g>

        <!-- Bidirectional Switching Arrows on Top Deck -->
        <g fill="#f8fafc">
          <polygon points="31.5,15.7 22.5,15.7 22.5,14.1 16.8,16.5 22.5,18.9 22.5,17.3 31.5,17.3" />
          <polygon points="36.2,15.7 44.5,15.7 44.5,14.1 50.2,16.5 44.5,18.9 44.5,17.3 36.2,17.3" />
          <polygon points="14.5,22 23.5,22 23.5,20.4 29.2,22.8 23.5,25.2 23.5,23.6 14.5,23.6" />
          <polygon points="46.2,22 37.8,22 37.8,20.4 32.1,22.8 37.8,25.2 37.8,23.6 46.2,23.6" />
        </g>
      `;

    case 'server':
      return `
        <defs>
          <linearGradient id="${p}_srv_top" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#38bdf8" />
            <stop offset="100%" stop-color="#1d4ed8" />
          </linearGradient>
          <linearGradient id="${p}_srv_front" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="#1e293b" />
            <stop offset="55%" stop-color="#0f172a" />
            <stop offset="100%" stop-color="#020617" />
          </linearGradient>
          <linearGradient id="${p}_srv_side" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#172554" />
            <stop offset="100%" stop-color="#090f1d" />
          </linearGradient>
        </defs>

        <!-- Ground Contact Shadow -->
        <ellipse cx="32.5" cy="50.8" rx="15" ry="3.2" fill="#020617" fill-opacity="0.22" />

        <!-- Top Isometric Plate -->
        <polygon
          points="16.5,9 30,3.8 47.5,7 34,12.2"
          fill="url(#${p}_srv_top)"
          stroke="#bae6fd"
          stroke-width="1.1"
          stroke-linejoin="round"
        />

        <!-- Front Anodized Server Faceplate -->
        <polygon
          points="16.5,9 34,12.2 34,51.2 16.5,48"
          fill="url(#${p}_srv_front)"
          stroke="#94a3b8"
          stroke-width="1.1"
          stroke-linejoin="round"
        />

        <!-- Right Chassis Side Panel -->
        <polygon
          points="34,12.2 47.5,7 47.5,45.5 34,51.2"
          fill="url(#${p}_srv_side)"
          stroke="#7dd3fc"
          stroke-opacity="0.7"
          stroke-width="1.1"
          stroke-linejoin="round"
        />

        <!-- Glowing Top Diagnostics / Telemetry Strip -->
        <line x1="18.6" y1="13" x2="29.4" y2="15" stroke="#22d3ee" stroke-width="1.5" stroke-linecap="round" />
        <circle cx="31.7" cy="15.4" r="1.05" fill="#10b981" />

        <!-- 4 Hot-Swap NVMe/SAS Storage Drive Bays -->
        <g>
          <!-- Bay 1 -->
          <polygon points="18.5,17.2 32,19.7 32,22.9 18.5,20.4" fill="#090f1d" stroke="#475569" stroke-width="0.65" />
          <line x1="20" y1="19" x2="27.5" y2="20.4" stroke="#64748b" stroke-width="0.9" stroke-linecap="round" />
          <circle cx="30.2" cy="21.1" r="0.7" fill="#10b981" />

          <!-- Bay 2 -->
          <polygon points="18.5,21.9 32,24.4 32,27.6 18.5,25.1" fill="#090f1d" stroke="#475569" stroke-width="0.65" />
          <line x1="20" y1="23.7" x2="27.5" y2="25.1" stroke="#64748b" stroke-width="0.9" stroke-linecap="round" />
          <circle cx="30.2" cy="25.8" r="0.7" fill="#38bdf8" />

          <!-- Bay 3 -->
          <polygon points="18.5,26.6 32,29.1 32,32.3 18.5,29.8" fill="#090f1d" stroke="#475569" stroke-width="0.65" />
          <line x1="20" y1="28.4" x2="27.5" y2="29.8" stroke="#64748b" stroke-width="0.9" stroke-linecap="round" />
          <circle cx="30.2" cy="30.5" r="0.7" fill="#10b981" />

          <!-- Bay 4 -->
          <polygon points="18.5,31.3 32,33.8 32,37 18.5,34.5" fill="#090f1d" stroke="#475569" stroke-width="0.65" />
          <line x1="20" y1="33.1" x2="27.5" y2="34.5" stroke="#64748b" stroke-width="0.9" stroke-linecap="round" />
          <circle cx="30.2" cy="35.2" r="0.7" fill="#10b981" />
        </g>

        <!-- Lower Thermal Airflow Louver Grille -->
        <g stroke="#475569" stroke-width="1.15" stroke-linecap="round">
          <line x1="19" y1="38.2" x2="31.5" y2="40.5" />
          <line x1="19" y1="41" x2="31.5" y2="43.3" />
          <line x1="19" y1="43.8" x2="31.5" y2="46.1" />
        </g>

        <!-- Subtle Side Chassis Structural Ribs -->
        <line x1="36.2" y1="16" x2="45.2" y2="12.2" stroke="#38bdf8" stroke-opacity="0.28" stroke-width="0.8" stroke-linecap="round" />
        <line x1="36.2" y1="44.2" x2="45.2" y2="40.2" stroke="#38bdf8" stroke-opacity="0.28" stroke-width="0.8" stroke-linecap="round" />
      `;

    case 'pc':
    default:
      return `
        <defs>
          <linearGradient id="${p}_pc_chassis" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#334155" />
            <stop offset="50%" stop-color="#1e293b" />
            <stop offset="100%" stop-color="#0f172a" />
          </linearGradient>
          <linearGradient id="${p}_pc_screen" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#020617" />
            <stop offset="60%" stop-color="#0c4a6e" />
            <stop offset="100%" stop-color="#0284c7" />
          </linearGradient>
          <linearGradient id="${p}_pc_stand" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="#cbd5e1" />
            <stop offset="100%" stop-color="#64748b" />
          </linearGradient>
          <linearGradient id="${p}_pc_kb" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#334155" />
            <stop offset="100%" stop-color="#0f172a" />
          </linearGradient>
        </defs>

        <!-- Ground Contact Shadow -->
        <ellipse cx="32" cy="50.5" rx="23" ry="3.2" fill="#020617" fill-opacity="0.18" />

        <!-- Sculpted Brushed-Aluminum Display Stand -->
        <polygon
          points="29,32.5 35,32.5 36.8,39.8 27.2,39.8"
          fill="url(#${p}_pc_stand)"
          stroke="#e2e8f0"
          stroke-opacity="0.6"
          stroke-width="0.6"
        />
        <polygon
          points="21,39.8 43,39.8 45.2,42 18.8,42"
          fill="url(#${p}_pc_stand)"
          stroke="#cbd5e1"
          stroke-width="0.8"
          stroke-linejoin="round"
        />

        <!-- Ultra-Thin Bezel Display Housing -->
        <rect
          x="10.5"
          y="6.5"
          width="43"
          height="26.5"
          rx="2.6"
          fill="url(#${p}_pc_chassis)"
          stroke="#94a3b8"
          stroke-width="1.15"
        />

        <!-- Dark-Glass IPS Panel -->
        <rect
          x="12.6"
          y="8.6"
          width="38.8"
          height="21"
          rx="1.2"
          fill="url(#${p}_pc_screen)"
          stroke="#38bdf8"
          stroke-opacity="0.45"
          stroke-width="0.6"
        />

        <!-- Subtle Glass Specular Sheen -->
        <polygon points="12.6,8.6 31,8.6 21,29.6 12.6,29.6" fill="#ffffff" fill-opacity="0.07" />

        <!-- Minimalist Terminal / Telemetry UI Hint on Screen -->
        <circle cx="15.2" cy="11.2" r="0.8" fill="#38bdf8" />
        <circle cx="17.8" cy="11.2" r="0.8" fill="#10b981" />
        <line x1="15.2" y1="14.6" x2="29.5" y2="14.6" stroke="#38bdf8" stroke-opacity="0.85" stroke-width="1.35" stroke-linecap="round" />
        <line x1="15.2" y1="18.2" x2="39.5" y2="18.2" stroke="#bae6fd" stroke-opacity="0.55" stroke-width="1.1" stroke-linecap="round" />
        <line x1="15.2" y1="21.6" x2="33.5" y2="21.6" stroke="#10b981" stroke-opacity="0.75" stroke-width="1.1" stroke-linecap="round" />
        <line x1="15.2" y1="25" x2="24" y2="25" stroke="#bae6fd" stroke-opacity="0.4" stroke-width="1.1" stroke-linecap="round" />

        <!-- Chin Power Indicator LED -->
        <circle cx="32" cy="31.3" r="0.8" fill="#22d3ee" />

        <!-- Sleek Compact Wireless Keyboard -->
        <polygon
          points="10,44.4 40.5,44.4 38.5,50.5 8,50.5"
          fill="url(#${p}_pc_kb)"
          stroke="#94a3b8"
          stroke-width="0.95"
          stroke-linejoin="round"
        />
        <line x1="11.5" y1="46.4" x2="37.2" y2="46.4" stroke="#cbd5e1" stroke-opacity="0.65" stroke-width="1.05" stroke-linecap="round" />
        <line x1="10.4" y1="48.5" x2="36.2" y2="48.5" stroke="#94a3b8" stroke-opacity="0.55" stroke-width="1.05" stroke-linecap="round" />

        <!-- Ergonomic Wireless Mouse -->
        <rect
          x="44.5"
          y="44.2"
          width="7.8"
          height="6.4"
          rx="3.2"
          fill="url(#${p}_pc_kb)"
          stroke="#94a3b8"
          stroke-width="0.95"
        />
        <line x1="48.4" y1="45.4" x2="48.4" y2="47.3" stroke="#38bdf8" stroke-width="1.05" stroke-linecap="round" />
      `;
  }
}

export const CiscoDeviceIcon: React.FC<CiscoDeviceIconProps> = ({
  type,
  className = 'w-12 h-10',
  title
}) => {
  const reactId = useId();
  const uidPrefix = `nd_${sanitizeSvgIdPrefix(reactId)}`;

  return (
    <svg
      viewBox="0 0 64 56"
      className={className}
      aria-hidden={title ? undefined : true}
      role={title ? 'img' : undefined}
      aria-label={title}
      dangerouslySetInnerHTML={{ __html: getCiscoDeviceInnerSvg(type, uidPrefix) }}
    />
  );
};
