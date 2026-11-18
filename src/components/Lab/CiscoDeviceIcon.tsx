import React from 'react';
import { SimDeviceType } from './networkSimTypes';

interface CiscoDeviceIconProps {
  type: SimDeviceType;
  className?: string;
  title?: string;
}

const PALETTE = {
  top: '#1b7fb8',
  front: '#0f6292',
  side: '#09486e',
  screen: '#e0f2fe',
  stroke: '#ffffff'
};

/**
 * Generates crisp, self-contained Cisco-style isometric 3D SVG inner markup
 * positioned inside a 64x56 coordinate box centered around (32, 28).
 * Used both by the interactive React canvas/toolbar and static PNG/SVG exports.
 */
export function getCiscoDeviceInnerSvg(type: SimDeviceType): string {
  switch (type) {
    case 'router':
      return `
        <!-- 3D Cylinder Body -->
        <path
          d="M 8 21 L 8 36 A 24 10 0 0 0 56 36 L 56 21 Z"
          fill="${PALETTE.front}"
          stroke="${PALETTE.stroke}"
          stroke-width="1.5"
          stroke-linejoin="round"
        />
        <!-- Subtle Right-Side Cylinder Shading -->
        <path
          d="M 32 31 A 24 10 0 0 0 56 21 L 56 36 A 24 10 0 0 1 32 46 Z"
          fill="${PALETTE.side}"
          fill-opacity="0.55"
        />
        <path
          d="M 8 21 L 8 36 A 24 10 0 0 0 56 36 L 56 21"
          fill="none"
          stroke="${PALETTE.stroke}"
          stroke-width="1.5"
          stroke-linejoin="round"
        />
        <!-- Top Elliptical Face -->
        <ellipse
          cx="32"
          cy="21"
          rx="24"
          ry="10"
          fill="${PALETTE.top}"
          stroke="${PALETTE.stroke}"
          stroke-width="1.5"
        />
        <!-- Classic 4-Arrow Cisco Router Pattern (2 inward, 2 outward) -->
        <!-- Top-Left Inward -->
        <polygon points="18,16 21,14.5 27,17.2 28.8,16.1 29.8,19.4 23.2,19.1 25,18.2" fill="${PALETTE.stroke}" />
        <!-- Bottom-Right Inward -->
        <polygon points="46,26 43,27.5 37,24.8 35.2,25.9 34.2,22.6 40.8,22.9 39,23.8" fill="${PALETTE.stroke}" />
        <!-- Top-Right Outward -->
        <polygon points="34,19.5 36.2,20.6 42.2,17.8 44,18.7 45.2,15.3 38.6,15.7 40.3,16.6" fill="${PALETTE.stroke}" />
        <!-- Bottom-Left Outward -->
        <polygon points="30,22.5 27.8,21.4 21.8,24.2 20,23.3 18.8,26.7 25.4,26.3 23.7,25.4" fill="${PALETTE.stroke}" />
      `;

    case 'switch':
      return `
        <!-- Isometric Top Face -->
        <polygon
          points="19,14 58,14 45,28 6,28"
          fill="${PALETTE.top}"
          stroke="${PALETTE.stroke}"
          stroke-width="1.5"
          stroke-linejoin="round"
        />
        <!-- Front Face -->
        <polygon
          points="6,28 45,28 45,41 6,41"
          fill="${PALETTE.front}"
          stroke="${PALETTE.stroke}"
          stroke-width="1.5"
          stroke-linejoin="round"
        />
        <!-- Right Bevel Face -->
        <polygon
          points="45,28 58,14 58,27 45,41"
          fill="${PALETTE.side}"
          stroke="${PALETTE.stroke}"
          stroke-width="1.5"
          stroke-linejoin="round"
        />
        <!-- Workgroup Switch Four Bidirectional Arrows on Top Face -->
        <!-- Upper-Left (pointing left) -->
        <polygon points="31,17.2 22,17.2 22,15.6 16.5,18 22,20.4 22,18.8 31,18.8" fill="${PALETTE.stroke}" />
        <!-- Upper-Right (pointing right) -->
        <polygon points="36,17.2 44.5,17.2 44.5,15.6 50,18 44.5,20.4 44.5,18.8 36,18.8" fill="${PALETTE.stroke}" />
        <!-- Lower-Left (pointing right) -->
        <polygon points="15,23.2 24,23.2 24,21.6 29.5,24 24,26.4 24,24.8 15,24.8" fill="${PALETTE.stroke}" />
        <!-- Lower-Right (pointing left) -->
        <polygon points="46,23.2 37.5,23.2 37.5,21.6 32,24 37.5,26.4 37.5,24.8 46,24.8" fill="${PALETTE.stroke}" />
      `;

    case 'server':
      return `
        <!-- Tower Top Face -->
        <polygon
          points="18,9 30,4 46,7 34,12"
          fill="${PALETTE.top}"
          stroke="${PALETTE.stroke}"
          stroke-width="1.4"
          stroke-linejoin="round"
        />
        <!-- Tower Front Face -->
        <polygon
          points="18,9 34,12 34,51 18,48"
          fill="${PALETTE.front}"
          stroke="${PALETTE.stroke}"
          stroke-width="1.4"
          stroke-linejoin="round"
        />
        <!-- Tower Right Side Face -->
        <polygon
          points="34,12 46,7 46,45 34,51"
          fill="${PALETTE.side}"
          stroke="${PALETTE.stroke}"
          stroke-width="1.4"
          stroke-linejoin="round"
        />
        <!-- Drive Bay Dividers & Optical Slot -->
        <line x1="18" y1="17" x2="34" y2="20" stroke="${PALETTE.stroke}" stroke-width="1.2" />
        <line x1="18" y1="24" x2="34" y2="27" stroke="${PALETTE.stroke}" stroke-width="1.2" />
        <line x1="21" y1="13.5" x2="31" y2="15.3" stroke="${PALETTE.stroke}" stroke-width="1.8" stroke-linecap="round" />
        <rect x="20.5" y="19.5" width="4.5" height="2" rx="0.5" fill="${PALETTE.stroke}" transform="skewY(10)" />
        <circle cx="30" cy="22.8" r="1.2" fill="${PALETTE.stroke}" />
        <!-- Vertical Chassis Seam & Lower Vent -->
        <line x1="26" y1="25.5" x2="26" y2="49.5" stroke="${PALETTE.stroke}" stroke-width="1" stroke-opacity="0.8" />
        <line x1="20.5" y1="43" x2="31.5" y2="45" stroke="${PALETTE.stroke}" stroke-width="1.2" stroke-opacity="0.85" />
      `;

    case 'pc':
    default:
      return `
        <!-- Monitor Top & Right Bezel -->
        <polygon
          points="14,10 19,6 47,6 42,10"
          fill="${PALETTE.top}"
          stroke="${PALETTE.stroke}"
          stroke-width="1.3"
          stroke-linejoin="round"
        />
        <polygon
          points="42,10 47,6 47,26 42,30"
          fill="${PALETTE.side}"
          stroke="${PALETTE.stroke}"
          stroke-width="1.3"
          stroke-linejoin="round"
        />
        <!-- Monitor Front Housing -->
        <rect
          x="14"
          y="10"
          width="28"
          height="20"
          rx="1.5"
          fill="${PALETTE.front}"
          stroke="${PALETTE.stroke}"
          stroke-width="1.4"
        />
        <!-- Display Screen -->
        <rect
          x="17"
          y="13"
          width="22"
          height="14"
          rx="1"
          fill="${PALETTE.screen}"
          stroke="${PALETTE.stroke}"
          stroke-width="0.9"
        />
        <!-- Desktop Base Unit Underneath Monitor -->
        <polygon
          points="10,33 44,33 48,29 48,36 44,40 10,40"
          fill="${PALETTE.side}"
          stroke="${PALETTE.stroke}"
          stroke-width="1.3"
          stroke-linejoin="round"
        />
        <rect
          x="10"
          y="33"
          width="34"
          height="7"
          fill="${PALETTE.front}"
          stroke="${PALETTE.stroke}"
          stroke-width="1.3"
        />
        <line x1="30" y1="36.5" x2="40" y2="36.5" stroke="${PALETTE.stroke}" stroke-width="1.3" stroke-linecap="round" />
        <!-- Angled Keyboard -->
        <polygon
          points="7,43 41,43 37,50 3,50"
          fill="${PALETTE.front}"
          stroke="${PALETTE.stroke}"
          stroke-width="1.3"
          stroke-linejoin="round"
        />
        <line x1="9" y1="45.8" x2="36.5" y2="45.8" stroke="${PALETTE.stroke}" stroke-width="0.9" stroke-opacity="0.85" />
        <line x1="7.5" y1="48" x2="34.5" y2="48" stroke="${PALETTE.stroke}" stroke-width="0.9" stroke-opacity="0.85" />
        <!-- Mouse & Cable -->
        <path
          d="M 48,36 C 54,36 54,42 50,44"
          fill="none"
          stroke="${PALETTE.top}"
          stroke-width="1.4"
          stroke-linecap="round"
        />
        <rect
          x="45"
          y="44"
          width="6.5"
          height="6"
          rx="2.5"
          fill="${PALETTE.front}"
          stroke="${PALETTE.stroke}"
          stroke-width="1.2"
        />
      `;
  }
}

export const CiscoDeviceIcon: React.FC<CiscoDeviceIconProps> = ({
  type,
  className = 'w-12 h-10',
  title
}) => {
  return (
    <svg
      viewBox="0 0 64 56"
      className={className}
      aria-hidden={title ? undefined : true}
      role={title ? 'img' : undefined}
      aria-label={title}
      dangerouslySetInnerHTML={{ __html: getCiscoDeviceInnerSvg(type) }}
    />
  );
};
