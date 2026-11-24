import React, { useId } from 'react';
import type { NetworkDeviceType } from '../../utils/networkDiagramData';

interface NetworkDeviceGlyphProps {
  type: NetworkDeviceType;
  className?: string;
}

function sanitizeSvgIdPrefix(prefix: string): string {
  const cleaned = prefix.replace(/[^a-zA-Z0-9_-]/g, '_');
  return cleaned.length > 0 ? cleaned : 'dg';
}

/**
 * Generates crisp, self-contained ConceptDraw / Cisco-style isometric & 3D vector
 * hardware symbols inside a 64x56 coordinate box. Uses scoped `uidPrefix` for all
 * `<defs>` gradients so instances never collide on canvas or inside SVG/PNG exports.
 */
export function getDiagramDeviceInnerSvg(
  type: NetworkDeviceType,
  uidPrefix: string = 'dg'
): string {
  const p = sanitizeSvgIdPrefix(uidPrefix);

  switch (type) {
    case 'core-router':
      return `
        <defs>
          <linearGradient id="${p}_cr_body" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stop-color="#0369a1" />
            <stop offset="32%" stop-color="#0ea5e9" />
            <stop offset="68%" stop-color="#0284c7" />
            <stop offset="100%" stop-color="#0c4a6e" />
          </linearGradient>
          <linearGradient id="${p}_cr_top" x1="15%" y1="0%" x2="85%" y2="100%">
            <stop offset="0%" stop-color="#38bdf8" />
            <stop offset="55%" stop-color="#0ea5e9" />
            <stop offset="100%" stop-color="#0284c7" />
          </linearGradient>
        </defs>
        <ellipse cx="32" cy="45" rx="23" ry="6.2" fill="#0f172a" fill-opacity="0.18" />
        <path d="M 8 20 L 8 36 A 24 10 0 0 0 56 36 L 56 20 Z" fill="url(#${p}_cr_body)" stroke="#bae6fd" stroke-width="1.2" stroke-linejoin="round" />
        <ellipse cx="32" cy="20" rx="24" ry="10" fill="url(#${p}_cr_top)" stroke="#e0f2fe" stroke-width="1.2" />
        <g fill="#ffffff">
          <polygon points="17.5,15.1 20.6,13.6 26.8,16.4 28.6,15.3 29.6,18.7 22.9,18.4 24.7,17.5" />
          <polygon points="46.5,24.9 43.4,26.4 37.2,23.6 35.4,24.7 34.4,21.3 41.1,21.6 39.3,22.5" />
          <polygon points="34.2,18.6 36.4,19.7 42.5,16.8 44.3,17.7 45.5,14.3 38.8,14.7 40.5,15.6" />
          <polygon points="29.8,21.4 27.6,20.3 21.5,23.2 19.7,22.3 18.5,25.7 25.2,25.3 23.5,24.4" />
        </g>
      `;

    case 'edge-router':
      return `
        <defs>
          <linearGradient id="${p}_er_body" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stop-color="#1e3a8a" />
            <stop offset="35%" stop-color="#2563eb" />
            <stop offset="70%" stop-color="#1d4ed8" />
            <stop offset="100%" stop-color="#172554" />
          </linearGradient>
          <linearGradient id="${p}_er_top" x1="12%" y1="0%" x2="88%" y2="100%">
            <stop offset="0%" stop-color="#60a5fa" />
            <stop offset="55%" stop-color="#2563eb" />
            <stop offset="100%" stop-color="#1e40af" />
          </linearGradient>
        </defs>
        <ellipse cx="32" cy="45" rx="23" ry="6.2" fill="#0f172a" fill-opacity="0.18" />
        <path d="M 8 20 L 8 36 A 24 10 0 0 0 56 36 L 56 20 Z" fill="url(#${p}_er_body)" stroke="#bfdbfe" stroke-width="1.2" stroke-linejoin="round" />
        <path d="M 16 34.5 A 24 10 0 0 0 48 34.5 L 48 38.8 A 24 10 0 0 1 16 38.8 Z" fill="#0f172a" fill-opacity="0.72" />
        <circle cx="24" cy="38.2" r="1" fill="#22c55e" />
        <circle cx="28" cy="38.7" r="1" fill="#38bdf8" />
        <ellipse cx="32" cy="20" rx="24" ry="10" fill="url(#${p}_er_top)" stroke="#dbeafe" stroke-width="1.2" />
        <g fill="#ffffff">
          <polygon points="17.5,15.1 20.6,13.6 26.8,16.4 28.6,15.3 29.6,18.7 22.9,18.4 24.7,17.5" />
          <polygon points="46.5,24.9 43.4,26.4 37.2,23.6 35.4,24.7 34.4,21.3 41.1,21.6 39.3,22.5" />
          <polygon points="34.2,18.6 36.4,19.7 42.5,16.8 44.3,17.7 45.5,14.3 38.8,14.7 40.5,15.6" />
          <polygon points="29.8,21.4 27.6,20.3 21.5,23.2 19.7,22.3 18.5,25.7 25.2,25.3 23.5,24.4" />
        </g>
      `;

    case 'l3-switch':
      return `
        <defs>
          <linearGradient id="${p}_l3_top" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#38bdf8" />
            <stop offset="100%" stop-color="#0284c7" />
          </linearGradient>
          <linearGradient id="${p}_l3_front" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="#0284c7" />
            <stop offset="100%" stop-color="#0369a1" />
          </linearGradient>
          <linearGradient id="${p}_l3_side" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#075985" />
            <stop offset="100%" stop-color="#0c4a6e" />
          </linearGradient>
        </defs>
        <polygon points="10,49 44,49 54,39 20,39" fill="#0f172a" fill-opacity="0.16" />
        <polygon points="20,7 54,7 44,16 10,16" fill="url(#${p}_l3_top)" stroke="#e0f2fe" stroke-width="1.1" stroke-linejoin="round" />
        <polygon points="10,16 44,16 44,48 10,48" fill="url(#${p}_l3_front)" stroke="#bae6fd" stroke-width="1.1" stroke-linejoin="round" />
        <polygon points="44,16 54,7 54,39 44,48" fill="url(#${p}_l3_side)" stroke="#7dd3fc" stroke-width="1.1" stroke-linejoin="round" />
        <circle cx="27" cy="32" r="7.5" fill="#fb7185" stroke="#ffffff" stroke-width="1.4" />
        <g stroke="#ffffff" stroke-width="1.9" stroke-linecap="round">
          <line x1="27" y1="19" x2="27" y2="24" />
          <line x1="27" y1="40" x2="27" y2="45" />
          <line x1="14" y1="32" x2="19" y2="32" />
          <line x1="35" y1="32" x2="40" y2="32" />
          <line x1="17.8" y1="22.8" x2="21.5" y2="26.5" />
          <line x1="32.5" y1="37.5" x2="36.2" y2="41.2" />
          <line x1="36.2" y1="22.8" x2="32.5" y2="26.5" />
          <line x1="21.5" y1="37.5" x2="17.8" y2="41.2" />
        </g>
        <g fill="#ffffff">
          <polygon points="27,17.2 24.8,20.5 29.2,20.5" />
          <polygon points="27,46.8 24.8,43.5 29.2,43.5" />
          <polygon points="12.2,32 15.5,29.8 15.5,34.2" />
          <polygon points="41.8,32 38.5,29.8 38.5,34.2" />
        </g>
      `;

    case 'l2-switch':
      return `
        <defs>
          <linearGradient id="${p}_l2_top" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#38bdf8" />
            <stop offset="55%" stop-color="#0ea5e9" />
            <stop offset="100%" stop-color="#0284c7" />
          </linearGradient>
          <linearGradient id="${p}_l2_front" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stop-color="#0284c7" />
            <stop offset="100%" stop-color="#0369a1" />
          </linearGradient>
          <linearGradient id="${p}_l2_side" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#075985" />
            <stop offset="100%" stop-color="#0c4a6e" />
          </linearGradient>
        </defs>
        <polygon points="8,44 47,44 58,31 19,31" fill="#0f172a" fill-opacity="0.16" />
        <polygon points="18,14 58,14 47,28 6,28" fill="url(#${p}_l2_top)" stroke="#e0f2fe" stroke-width="1.15" stroke-linejoin="round" />
        <polygon points="6,28 47,28 47,41 6,41" fill="url(#${p}_l2_front)" stroke="#bae6fd" stroke-width="1.15" stroke-linejoin="round" />
        <polygon points="47,28 58,14 58,27 47,41" fill="url(#${p}_l2_side)" stroke="#7dd3fc" stroke-width="1.15" stroke-linejoin="round" />
        <g fill="#ffffff">
          <polygon points="31.5,17.3 22.5,17.3 22.5,15.7 16.8,18.1 22.5,20.5 22.5,18.9 31.5,18.9" />
          <polygon points="36.2,17.3 44.5,17.3 44.5,15.7 50.2,18.1 44.5,20.5 44.5,18.9 36.2,18.9" />
          <polygon points="14.5,23.2 23.5,23.2 23.5,21.6 29.2,24 23.5,26.4 23.5,24.8 14.5,24.8" />
          <polygon points="46.2,23.2 37.8,23.2 37.8,21.6 32.1,24 37.8,26.4 37.8,24.8 46.2,24.8" />
        </g>
        <circle cx="12" cy="34.5" r="1.1" fill="#86efac" />
        <circle cx="16" cy="34.5" r="1.1" fill="#86efac" />
        <circle cx="20" cy="34.5" r="1.1" fill="#bae6fd" />
        <rect x="35" y="32.2" width="8.5" height="4.6" rx="0.8" fill="#082f49" fill-opacity="0.65" />
      `;

    case 'firewall':
      return `
        <defs>
          <linearGradient id="${p}_fw_front" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#ef4444" />
            <stop offset="100%" stop-color="#b91c1c" />
          </linearGradient>
          <linearGradient id="${p}_fw_top" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#fca5a5" />
            <stop offset="100%" stop-color="#dc2626" />
          </linearGradient>
          <linearGradient id="${p}_fw_side" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#991b1b" />
            <stop offset="100%" stop-color="#7f1d1d" />
          </linearGradient>
        </defs>
        <polygon points="9,47 45,47 55,37 19,37" fill="#0f172a" fill-opacity="0.16" />
        <polygon points="18,10 54,10 45,18 9,18" fill="url(#${p}_fw_top)" stroke="#fecaca" stroke-width="1.1" stroke-linejoin="round" />
        <polygon points="9,18 45,18 45,45 9,45" fill="url(#${p}_fw_front)" stroke="#fecaca" stroke-width="1.1" stroke-linejoin="round" />
        <polygon points="45,18 54,10 54,37 45,45" fill="url(#${p}_fw_side)" stroke="#fca5a5" stroke-width="1.1" stroke-linejoin="round" />
        <g stroke="#fee2e2" stroke-opacity="0.85" stroke-width="1.2">
          <line x1="9" y1="27" x2="45" y2="27" />
          <line x1="9" y1="36" x2="45" y2="36" />
          <line x1="21" y1="18" x2="21" y2="27" />
          <line x1="33" y1="18" x2="33" y2="27" />
          <line x1="15" y1="27" x2="15" y2="36" />
          <line x1="27" y1="27" x2="27" y2="36" />
          <line x1="39" y1="27" x2="39" y2="36" />
          <line x1="21" y1="36" x2="21" y2="45" />
          <line x1="33" y1="36" x2="33" y2="45" />
        </g>
      `;

    case 'load-balancer':
      return `
        <defs>
          <linearGradient id="${p}_lb_top" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#fbbf24" />
            <stop offset="100%" stop-color="#d97706" />
          </linearGradient>
          <linearGradient id="${p}_lb_front" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="#f59e0b" />
            <stop offset="100%" stop-color="#b45309" />
          </linearGradient>
          <linearGradient id="${p}_lb_side" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#92400e" />
            <stop offset="100%" stop-color="#78350f" />
          </linearGradient>
        </defs>
        <polygon points="8,45 46,45 56,33 18,33" fill="#0f172a" fill-opacity="0.16" />
        <polygon points="18,12 56,12 46,23 8,23" fill="url(#${p}_lb_top)" stroke="#fde68a" stroke-width="1.1" stroke-linejoin="round" />
        <polygon points="8,23 46,23 46,43 8,43" fill="url(#${p}_lb_front)" stroke="#fde68a" stroke-width="1.1" stroke-linejoin="round" />
        <polygon points="46,23 56,12 56,32 46,43" fill="url(#${p}_lb_side)" stroke="#fcd34d" stroke-width="1.1" stroke-linejoin="round" />
        <path d="M 14 33 H 25 M 25 33 L 36 27 M 25 33 L 36 39" fill="none" stroke="#ffffff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" />
        <polygon points="39,25.5 33.5,25 36.2,29.5" fill="#ffffff" />
        <polygon points="39,40.5 36.2,36.5 33.5,41" fill="#ffffff" />
      `;

    case 'vpn-gateway':
      return `
        <defs>
          <linearGradient id="${p}_vpn_shield" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#8b5cf6" />
            <stop offset="100%" stop-color="#5b21b6" />
          </linearGradient>
        </defs>
        <ellipse cx="32" cy="49" rx="16" ry="4" fill="#0f172a" fill-opacity="0.16" />
        <path d="M 32 6 L 52 14 V 27 C 52 38.5 43.2 46.8 32 50 C 20.8 46.8 12 38.5 12 27 V 14 L 32 6 Z" fill="url(#${p}_vpn_shield)" stroke="#ddd6fe" stroke-width="1.3" stroke-linejoin="round" />
        <path d="M 32 9.5 L 48.5 16.2 V 26.8 C 48.5 36.4 41.2 43.4 32 46.3 C 22.8 43.4 15.5 36.4 15.5 26.8 V 16.2 L 32 9.5 Z" fill="none" stroke="#ede9fe" stroke-opacity="0.45" stroke-width="0.9" />
        <rect x="23" y="25" width="18" height="13" rx="2.5" fill="#ffffff" fill-opacity="0.95" />
        <path d="M 26.5 25 V 21 A 5.5 5.5 0 0 1 37.5 21 V 25" fill="none" stroke="#ffffff" stroke-width="2.4" stroke-linecap="round" />
        <circle cx="32" cy="31" r="1.8" fill="#5b21b6" />
        <line x1="32" y1="32" x2="32" y2="35" stroke="#5b21b6" stroke-width="1.8" stroke-linecap="round" />
      `;

    case 'wan-cloud':
      return `
        <defs>
          <linearGradient id="${p}_wc_fill" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="#ffffff" />
            <stop offset="65%" stop-color="#e0f2fe" />
            <stop offset="100%" stop-color="#bae6fd" />
          </linearGradient>
        </defs>
        <ellipse cx="32" cy="45.5" rx="22" ry="4.5" fill="#0f172a" fill-opacity="0.1" />
        <path
          d="M 16 42 H 48 C 54.5 42 59 37.5 59 31.8 C 59 26.6 55 22.4 49.8 21.6 C 47.6 12.6 39.6 7 30.2 7.5 C 21.3 8 14.3 14.8 13.7 23.6 C 8.7 25 5 29.2 5 34.4 C 5 38.8 9.2 42 16 42 Z"
          fill="url(#${p}_wc_fill)"
          stroke="#7dd3fc"
          stroke-width="1.6"
          stroke-linejoin="round"
        />
        <path d="M 16 25 C 18.5 17 24.8 12 31.5 11.8" fill="none" stroke="#ffffff" stroke-width="1.4" stroke-linecap="round" stroke-opacity="0.85" />
      `;

    case 'wlc':
      return `
        <defs>
          <linearGradient id="${p}_wlc_top" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#2dd4bf" />
            <stop offset="100%" stop-color="#0d9488" />
          </linearGradient>
          <linearGradient id="${p}_wlc_front" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stop-color="#0f766e" />
            <stop offset="100%" stop-color="#115e59" />
          </linearGradient>
        </defs>
        <polygon points="8,44 47,44 58,31 19,31" fill="#0f172a" fill-opacity="0.15" />
        <polygon points="18,14 58,14 47,27 6,27" fill="url(#${p}_wlc_top)" stroke="#ccfbf1" stroke-width="1.15" stroke-linejoin="round" />
        <polygon points="6,27 47,27 47,41 6,41" fill="url(#${p}_wlc_front)" stroke="#99f6e4" stroke-width="1.15" stroke-linejoin="round" />
        <polygon points="47,27 58,14 58,28 47,41" fill="#134e4a" stroke="#5eead4" stroke-width="1.15" stroke-linejoin="round" />
        <path d="M 24 22.5 C 27.5 19.5 34.5 19.5 38 22.5 M 27 24.5 C 29.5 22.5 32.5 22.5 35 24.5" fill="none" stroke="#ffffff" stroke-width="1.9" stroke-linecap="round" />
        <circle cx="31" cy="26" r="1.4" fill="#ffffff" />
        <rect x="11" y="32" width="20" height="4.5" rx="0.8" fill="#042f2e" fill-opacity="0.7" />
        <circle cx="38" cy="34.2" r="1.2" fill="#34d399" />
        <circle cx="42" cy="34.2" r="1.2" fill="#5eead4" />
      `;

    case 'access-point':
      return `
        <defs>
          <linearGradient id="${p}_ap_disc" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#34d399" />
            <stop offset="100%" stop-color="#059669" />
          </linearGradient>
        </defs>
        <ellipse cx="32" cy="46.5" rx="20" ry="5.5" fill="#0f172a" fill-opacity="0.15" />
        <ellipse cx="32" cy="39" rx="21" ry="8.5" fill="#047857" stroke="#a7f3d0" stroke-width="1.1" />
        <ellipse cx="32" cy="35" rx="21" ry="8.5" fill="url(#${p}_ap_disc)" stroke="#d1fae5" stroke-width="1.15" />
        <circle cx="32" cy="35" r="2.2" fill="#ffffff" />
        <path d="M 22 25 C 27.5 20.5 36.5 20.5 42 25 M 16.5 19.5 C 25 13 39 13 47.5 19.5 M 11 14 C 22.5 5.5 41.5 5.5 53 14" fill="none" stroke="#10b981" stroke-width="2.2" stroke-linecap="round" />
      `;

    case 'server':
      return `
        <defs>
          <linearGradient id="${p}_srv_top" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#60a5fa" />
            <stop offset="100%" stop-color="#1d4ed8" />
          </linearGradient>
          <linearGradient id="${p}_srv_front" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="#334155" />
            <stop offset="100%" stop-color="#0f172a" />
          </linearGradient>
          <linearGradient id="${p}_srv_side" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#1e3a8a" />
            <stop offset="100%" stop-color="#090f1d" />
          </linearGradient>
        </defs>
        <ellipse cx="32" cy="50.5" rx="16" ry="3.5" fill="#020617" fill-opacity="0.2" />
        <polygon points="15,9 30,4 48,7.5 33,12.5" fill="url(#${p}_srv_top)" stroke="#bae6fd" stroke-width="1.1" stroke-linejoin="round" />
        <polygon points="15,9 33,12.5 33,50.5 15,47" fill="url(#${p}_srv_front)" stroke="#94a3b8" stroke-width="1.1" stroke-linejoin="round" />
        <polygon points="33,12.5 48,7.5 48,45 33,50.5" fill="url(#${p}_srv_side)" stroke="#7dd3fc" stroke-opacity="0.7" stroke-width="1.1" stroke-linejoin="round" />
        <line x1="17.5" y1="13.5" x2="28.5" y2="15.6" stroke="#38bdf8" stroke-width="1.7" stroke-linecap="round" />
        <circle cx="30.8" cy="16" r="1.1" fill="#22c55e" />
        <polygon points="17.5,18 31,20.5 31,23.8 17.5,21.3" fill="#090f1d" stroke="#475569" stroke-width="0.7" />
        <polygon points="17.5,23 31,25.5 31,28.8 17.5,26.3" fill="#090f1d" stroke="#475569" stroke-width="0.7" />
        <polygon points="17.5,28 31,30.5 31,33.8 17.5,31.3" fill="#090f1d" stroke="#475569" stroke-width="0.7" />
        <polygon points="17.5,33 31,35.5 31,38.8 17.5,36.3" fill="#090f1d" stroke="#475569" stroke-width="0.7" />
        <g stroke="#475569" stroke-width="1.2" stroke-linecap="round">
          <line x1="18" y1="41" x2="30" y2="43.2" />
          <line x1="18" y1="44" x2="30" y2="46.2" />
        </g>
      `;

    case 'ip-phone':
      return `
        <defs>
          <linearGradient id="${p}_ph_base" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#38bdf8" />
            <stop offset="100%" stop-color="#0284c7" />
          </linearGradient>
          <linearGradient id="${p}_ph_hs" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stop-color="#0284c7" />
            <stop offset="50%" stop-color="#0ea5e9" />
            <stop offset="100%" stop-color="#0369a1" />
          </linearGradient>
        </defs>
        <ellipse cx="32" cy="46.5" rx="22" ry="5" fill="#0f172a" fill-opacity="0.16" />
        <polygon points="15,17 53,17 47,42 9,42" fill="url(#${p}_ph_base)" stroke="#e0f2fe" stroke-width="1.15" stroke-linejoin="round" />
        <polygon points="9,42 47,42 47,46 9,46" fill="#075985" stroke="#bae6fd" stroke-width="1" stroke-linejoin="round" />
        <polygon points="47,42 53,17 53,21 47,46" fill="#0c4a6e" stroke="#7dd3fc" stroke-width="1" stroke-linejoin="round" />
        <!-- Handset cradle & receiver -->
        <path d="M 14 14 C 13 10 20 8.5 23 11.5 L 22 15 L 18.5 34.5 L 15 36.5 C 11 36.5 9.5 31 11 26 Z" fill="url(#${p}_ph_hs)" stroke="#e0f2fe" stroke-width="1.1" stroke-linejoin="round" />
        <!-- LCD Screen -->
        <polygon points="27,20.5 46,20.5 44.5,28 25.5,28" fill="#0c4a6e" stroke="#bae6fd" stroke-width="0.9" />
        <text x="35.5" y="25.5" text-anchor="middle" fill="#7dd3fc" font-family="sans-serif" font-size="6.5" font-weight="700">IP</text>
        <!-- Keypad dots -->
        <g fill="#e0f2fe">
          <rect x="25" y="30.5" width="4" height="2.4" rx="0.5" />
          <rect x="31" y="30.5" width="4" height="2.4" rx="0.5" />
          <rect x="37" y="30.5" width="4" height="2.4" rx="0.5" />
          <rect x="24.2" y="34.5" width="4" height="2.4" rx="0.5" />
          <rect x="30.2" y="34.5" width="4" height="2.4" rx="0.5" />
          <rect x="36.2" y="34.5" width="4" height="2.4" rx="0.5" />
        </g>
      `;

    case 'analog-cctv':
      return `
        <defs>
          <linearGradient id="${p}_ac_body" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="#f8fafc" />
            <stop offset="55%" stop-color="#cbd5e1" />
            <stop offset="100%" stop-color="#94a3b8" />
          </linearGradient>
          <linearGradient id="${p}_ac_hood" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#e2e8f0" />
            <stop offset="100%" stop-color="#64748b" />
          </linearGradient>
          <linearGradient id="${p}_ac_lens" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#334155" />
            <stop offset="100%" stop-color="#0f172a" />
          </linearGradient>
        </defs>
        <ellipse cx="32" cy="49" rx="19" ry="3.8" fill="#0f172a" fill-opacity="0.14" />
        <!-- Wall mount plate & articulated arm -->
        <rect x="7" y="25" width="4.5" height="17" rx="1.2" fill="#475569" stroke="#cbd5e1" stroke-width="0.9" />
        <path d="M 11.5 34 L 24 34 L 28 27" fill="none" stroke="#64748b" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round" />
        <circle cx="24" cy="34" r="2.1" fill="#334155" stroke="#cbd5e1" stroke-width="0.7" />
        <!-- Coax BNC cable loop -->
        <path d="M 17 24 C 12 29 14 40 20 42" fill="none" stroke="#d97706" stroke-width="1.6" stroke-linecap="round" />
        <rect x="19" y="40.2" width="4" height="3" rx="0.6" fill="#f59e0b" stroke="#78350f" stroke-width="0.7" />
        <!-- Box camera body & sunshield -->
        <polygon points="16,13 46,18 46,30 16,25" fill="url(#${p}_ac_body)" stroke="#475569" stroke-width="1.1" stroke-linejoin="round" />
        <polygon points="15,12 49,17.5 47,20 15,14.5" fill="url(#${p}_ac_hood)" stroke="#475569" stroke-width="1" stroke-linejoin="round" />
        <!-- Lens barrel & dark glass -->
        <ellipse cx="48.5" cy="24" rx="5.2" ry="6.4" fill="url(#${p}_ac_lens)" stroke="#94a3b8" stroke-width="1.2" />
        <ellipse cx="49.3" cy="24" rx="3" ry="4" fill="#020617" stroke="#f59e0b" stroke-width="0.9" />
        <circle cx="48.4" cy="22.4" r="1" fill="#ffffff" fill-opacity="0.65" />
        <!-- Power / IR indicator -->
        <circle cx="22" cy="19.5" r="1.3" fill="#ef4444" />
      `;

    case 'digital-cctv':
      return `
        <defs>
          <linearGradient id="${p}_dc_ring" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#f8fafc" />
            <stop offset="65%" stop-color="#cbd5e1" />
            <stop offset="100%" stop-color="#64748b" />
          </linearGradient>
          <radialGradient id="${p}_dc_dome" cx="42%" cy="38%" r="62%">
            <stop offset="0%" stop-color="#38bdf8" stop-opacity="0.9" />
            <stop offset="45%" stop-color="#0369a1" />
            <stop offset="100%" stop-color="#090f1d" />
          </radialGradient>
        </defs>
        <ellipse cx="32" cy="48.5" rx="20" ry="4.5" fill="#0f172a" fill-opacity="0.16" />
        <!-- Ceiling / PoE mounting base -->
        <ellipse cx="32" cy="14" rx="22" ry="7.5" fill="#475569" stroke="#cbd5e1" stroke-width="1.1" />
        <path d="M 10 14 L 10 19 A 22 7.5 0 0 0 54 19 L 54 14 Z" fill="url(#${p}_dc_ring)" stroke="#64748b" stroke-width="1.1" />
        <ellipse cx="32" cy="19" rx="21.5" ry="7.2" fill="#e2e8f0" stroke="#94a3b8" stroke-width="1" />
        <!-- Smoked glass dome -->
        <path d="M 14 21 A 18 20 0 0 0 50 21 Z" fill="url(#${p}_dc_dome)" stroke="#38bdf8" stroke-width="1.2" />
        <!-- Internal IP optics lens -->
        <circle cx="35" cy="29" r="6.2" fill="#0f172a" stroke="#7dd3fc" stroke-width="1.1" />
        <circle cx="35.6" cy="29" r="3" fill="#0284c7" />
        <circle cx="34.2" cy="27.5" r="1.2" fill="#ffffff" fill-opacity="0.75" />
        <!-- Dome glass highlight & PoE link LED -->
        <path d="M 19 23 C 20 30 23 35 28 38" fill="none" stroke="#ffffff" stroke-opacity="0.4" stroke-width="1.8" stroke-linecap="round" />
        <circle cx="20" cy="17.5" r="1.3" fill="#22c55e" />
        <circle cx="24" cy="18.2" r="1.3" fill="#38bdf8" />
      `;

    case 'smart-cctv':
      return `
        <defs>
          <linearGradient id="${p}_sc_body" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#ffffff" />
            <stop offset="60%" stop-color="#cbd5e1" />
            <stop offset="100%" stop-color="#64748b" />
          </linearGradient>
          <linearGradient id="${p}_sc_base" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stop-color="#059669" />
            <stop offset="50%" stop-color="#10b981" />
            <stop offset="100%" stop-color="#047857" />
          </linearGradient>
          <radialGradient id="${p}_sc_eye" cx="40%" cy="40%" r="60%">
            <stop offset="0%" stop-color="#34d399" />
            <stop offset="55%" stop-color="#0f172a" />
            <stop offset="100%" stop-color="#020617" />
          </radialGradient>
        </defs>
        <ellipse cx="32" cy="49.5" rx="18" ry="4.2" fill="#0f172a" fill-opacity="0.16" />
        <!-- Smart Wi-Fi / AI signal arcs -->
        <path d="M 41 11 C 45.5 11.5 49 15 49.5 19.5" fill="none" stroke="#10b981" stroke-width="2" stroke-linecap="round" />
        <path d="M 42.5 6.5 C 49.5 7.5 54 12 54.5 19" fill="none" stroke="#34d399" stroke-width="2" stroke-linecap="round" />
        <!-- Motorized PTZ base -->
        <path d="M 18 39 L 18 45 A 14 4.8 0 0 0 46 45 L 46 39 Z" fill="url(#${p}_sc_base)" stroke="#a7f3d0" stroke-width="1.1" />
        <ellipse cx="32" cy="39" rx="14" ry="4.8" fill="#34d399" stroke="#d1fae5" stroke-width="1" />
        <!-- Gimbal stem -->
        <rect x="27" y="32" width="10" height="7" rx="2" fill="#475569" stroke="#cbd5e1" stroke-width="0.9" />
        <!-- Smart spherical camera head -->
        <circle cx="32" cy="23" r="13.5" fill="url(#${p}_sc_body)" stroke="#64748b" stroke-width="1.2" />
        <!-- Dark visor & AI tracking lens -->
        <rect x="21.5" y="15.5" width="21" height="14.5" rx="7" fill="#0f172a" stroke="#10b981" stroke-width="1.2" />
        <circle cx="32" cy="22.8" r="5" fill="url(#${p}_sc_eye)" stroke="#34d399" stroke-width="1" />
        <circle cx="30.6" cy="21.3" r="1.4" fill="#ffffff" fill-opacity="0.8" />
        <!-- AI LED -->
        <circle cx="39" cy="19" r="1.2" fill="#38bdf8" />
      `;

    case 'nvr':
      return `
        <defs>
          <linearGradient id="${p}_nvr_top" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#38bdf8" />
            <stop offset="100%" stop-color="#0284c7" />
          </linearGradient>
          <linearGradient id="${p}_nvr_front" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="#1e3a8a" />
            <stop offset="100%" stop-color="#0f172a" />
          </linearGradient>
          <linearGradient id="${p}_nvr_side" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#1d4ed8" />
            <stop offset="100%" stop-color="#090f1d" />
          </linearGradient>
        </defs>
        <polygon points="8,45 47,45 58,32 19,32" fill="#0f172a" fill-opacity="0.16" />
        <polygon points="18,13 58,13 47,25 6,25" fill="url(#${p}_nvr_top)" stroke="#bae6fd" stroke-width="1.15" stroke-linejoin="round" />
        <polygon points="6,25 47,25 47,42 6,42" fill="url(#${p}_nvr_front)" stroke="#93c5fd" stroke-width="1.15" stroke-linejoin="round" />
        <polygon points="47,25 58,13 58,30 47,42" fill="url(#${p}_nvr_side)" stroke="#60a5fa" stroke-width="1.15" stroke-linejoin="round" />
        <!-- 2x2 CCTV grid on top face -->
        <g fill="#082f49" stroke="#e0f2fe" stroke-width="0.8">
          <polygon points="24,15.5 32.5,15.5 30,18.5 21.5,18.5" />
          <polygon points="34,15.5 42.5,15.5 40,18.5 31.5,18.5" />
          <polygon points="20.5,19.5 29,19.5 26.5,22.5 18,22.5" />
          <polygon points="30.5,19.5 39,19.5 36.5,22.5 28,22.5" />
        </g>
        <!-- NVR front panel -->
        <text x="17" y="36" text-anchor="middle" fill="#7dd3fc" font-family="sans-serif" font-size="8" font-weight="800">NVR</text>
        <circle cx="29" cy="31" r="1.2" fill="#22c55e" />
        <circle cx="33" cy="31" r="1.2" fill="#38bdf8" />
        <g fill="#020617" stroke="#38bdf8" stroke-width="0.6">
          <rect x="28" y="34" width="3.5" height="3.5" rx="0.5" />
          <rect x="33" y="34" width="3.5" height="3.5" rx="0.5" />
          <rect x="38" y="34" width="3.5" height="3.5" rx="0.5" />
        </g>
      `;

    case 'dvr':
      return `
        <defs>
          <linearGradient id="${p}_dvr_top" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#818cf8" />
            <stop offset="100%" stop-color="#4338ca" />
          </linearGradient>
          <linearGradient id="${p}_dvr_front" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="#312e81" />
            <stop offset="100%" stop-color="#0f172a" />
          </linearGradient>
          <linearGradient id="${p}_dvr_side" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#3730a3" />
            <stop offset="100%" stop-color="#090f1d" />
          </linearGradient>
        </defs>
        <polygon points="8,45 47,45 58,32 19,32" fill="#0f172a" fill-opacity="0.16" />
        <polygon points="18,13 58,13 47,25 6,25" fill="url(#${p}_dvr_top)" stroke="#c7d2fe" stroke-width="1.15" stroke-linejoin="round" />
        <polygon points="6,25 47,25 47,42 6,42" fill="url(#${p}_dvr_front)" stroke="#a5b4fc" stroke-width="1.15" stroke-linejoin="round" />
        <polygon points="47,25 58,13 58,30 47,42" fill="url(#${p}_dvr_side)" stroke="#818cf8" stroke-width="1.15" stroke-linejoin="round" />
        <!-- Analog reel / recording disc icon on top -->
        <ellipse cx="32" cy="19" rx="10" ry="3.8" fill="#1e1b4b" stroke="#e0e7ff" stroke-width="0.9" />
        <circle cx="32" cy="19" r="1.8" fill="#f87171" />
        <!-- DVR front panel & BNC coax port rings -->
        <text x="17" y="36" text-anchor="middle" fill="#c7d2fe" font-family="sans-serif" font-size="8" font-weight="800">DVR</text>
        <circle cx="29" cy="30.5" r="1.3" fill="#ef4444" />
        <circle cx="33.5" cy="30.5" r="1.2" fill="#22c55e" />
        <g fill="#1e1b4b" stroke="#fbbf24" stroke-width="0.8">
          <circle cx="30" cy="36" r="1.8" />
          <circle cx="35.5" cy="36" r="1.8" />
          <circle cx="41" cy="36" r="1.8" />
        </g>
      `;

    case 'workstation':
    default:
      return `
        <defs>
          <linearGradient id="${p}_ws_body" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#f1f5f9" />
            <stop offset="100%" stop-color="#cbd5e1" />
          </linearGradient>
          <linearGradient id="${p}_ws_screen" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#0284c7" />
            <stop offset="60%" stop-color="#2563eb" />
            <stop offset="100%" stop-color="#1e3a8a" />
          </linearGradient>
        </defs>
        <ellipse cx="32" cy="50.5" rx="22" ry="3.4" fill="#0f172a" fill-opacity="0.16" />
        <polygon points="28,33 36,33 38,40.5 26,40.5" fill="#94a3b8" stroke="#64748b" stroke-width="0.8" />
        <polygon points="20,40.5 44,40.5 46,42.5 18,42.5" fill="#cbd5e1" stroke="#64748b" stroke-width="0.9" stroke-linejoin="round" />
        <rect x="10" y="6" width="44" height="27.5" rx="3" fill="url(#${p}_ws_body)" stroke="#64748b" stroke-width="1.2" />
        <rect x="13" y="9" width="38" height="20.5" rx="1.4" fill="url(#${p}_ws_screen)" stroke="#38bdf8" stroke-opacity="0.6" stroke-width="0.8" />
        <polygon points="13,9 32,9 21,29.5 13,29.5" fill="#ffffff" fill-opacity="0.14" />
        <circle cx="32" cy="31.4" r="0.9" fill="#0284c7" />
        <polygon points="11,44.5 41,44.5 39,50 9,50" fill="#e2e8f0" stroke="#64748b" stroke-width="1" stroke-linejoin="round" />
        <line x1="12.5" y1="46.6" x2="37.5" y2="46.6" stroke="#64748b" stroke-width="1" stroke-linecap="round" />
        <rect x="44.5" y="44.3" width="8" height="5.8" rx="2.9" fill="#e2e8f0" stroke="#64748b" stroke-width="1" />
      `;
  }
}

export const NetworkDeviceGlyph: React.FC<NetworkDeviceGlyphProps> = ({
  type,
  className = 'w-10 h-9'
}) => {
  const reactId = useId();
  const uidPrefix = `dg_${sanitizeSvgIdPrefix(reactId)}`;

  return (
    <svg
      viewBox="0 0 64 56"
      className={className}
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: getDiagramDeviceInnerSvg(type, uidPrefix) }}
    />
  );
};
