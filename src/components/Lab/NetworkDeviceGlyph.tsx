import React from 'react';
import { NetworkDeviceType } from '../../utils/networkDiagramData';

interface NetworkDeviceGlyphProps {
  type: NetworkDeviceType;
  className?: string;
}

/**
 * Crisp Cisco / Visio-inspired vector engineering symbols for network topology diagrams.
 */
export const NetworkDeviceGlyph: React.FC<NetworkDeviceGlyphProps> = ({
  type,
  className = 'w-7 h-7'
}) => {
  switch (type) {
    case 'core-router':
    case 'edge-router':
      return (
        <svg viewBox="0 0 36 36" fill="none" className={className} aria-hidden="true">
          <circle
            cx="18"
            cy="18"
            r="14"
            className={
              type === 'core-router'
                ? 'fill-blue-600/15 stroke-blue-600 dark:stroke-cyan-400'
                : 'fill-sky-600/15 stroke-sky-600 dark:stroke-sky-400'
            }
            strokeWidth="2"
          />
          <path
            d="M12 12L16 16M16 16H12.5M16 16V12.5M24 24L20 20M20 20H23.5M20 20V23.5M24 12L20 16M20 16H23.5M20 16V12.5M12 24L16 20M16 20H12.5M16 20V23.5"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );

    case 'l3-switch':
      return (
        <svg viewBox="0 0 36 36" fill="none" className={className} aria-hidden="true">
          <rect
            x="4"
            y="6"
            width="28"
            height="24"
            rx="5"
            className="fill-indigo-600/15 stroke-indigo-600 dark:stroke-indigo-400"
            strokeWidth="2"
          />
          <circle
            cx="18"
            cy="18"
            r="6.5"
            stroke="currentColor"
            strokeWidth="1.6"
          />
          <path
            d="M8 18H11.5M24.5 18H28M18 8V11.5M18 24.5V28M15.5 18H20.5M18 15.5V20.5"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </svg>
      );

    case 'l2-switch':
      return (
        <svg viewBox="0 0 36 36" fill="none" className={className} aria-hidden="true">
          <rect
            x="4"
            y="9"
            width="28"
            height="18"
            rx="4"
            className="fill-cyan-600/15 stroke-cyan-600 dark:stroke-cyan-400"
            strokeWidth="2"
          />
          <path
            d="M9 14H24M21 11.5L24.5 14L21 16.5M27 22H12M15 19.5L11.5 22L15 24.5"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );

    case 'firewall':
      return (
        <svg viewBox="0 0 36 36" fill="none" className={className} aria-hidden="true">
          <rect
            x="5"
            y="7"
            width="26"
            height="22"
            rx="3.5"
            className="fill-red-600/15 stroke-red-600 dark:stroke-red-400"
            strokeWidth="2"
          />
          <path
            d="M5 14H31M5 21.5H31M14 7V14M22 14V21.5M14 21.5V29"
            stroke="currentColor"
            strokeWidth="1.6"
          />
        </svg>
      );

    case 'load-balancer':
      return (
        <svg viewBox="0 0 36 36" fill="none" className={className} aria-hidden="true">
          <rect
            x="4"
            y="7"
            width="28"
            height="22"
            rx="5"
            className="fill-amber-500/15 stroke-amber-600 dark:stroke-amber-400"
            strokeWidth="2"
          />
          <path
            d="M9 18H16M16 18L24 12M16 18L24 24M21.5 11.5H24.5V14.5M21.5 24.5H24.5V21.5"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );

    case 'vpn-gateway':
      return (
        <svg viewBox="0 0 36 36" fill="none" className={className} aria-hidden="true">
          <path
            d="M18 4L30 9.5V17.5C30 24.8 24.8 30.2 18 32C11.2 30.2 6 24.8 6 17.5V9.5L18 4Z"
            className="fill-violet-600/15 stroke-violet-600 dark:stroke-violet-400"
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <rect x="13" y="16" width="10" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.6" />
          <path d="M15 16V13.5A3 3 0 0 1 21 13.5V16" stroke="currentColor" strokeWidth="1.6" />
        </svg>
      );

    case 'wan-cloud':
      return (
        <svg viewBox="0 0 36 36" fill="none" className={className} aria-hidden="true">
          <path
            d="M11.5 27H25.5C28.5 27 31 24.6 31 21.6C31 18.9 29 16.7 26.4 16.3C25.5 11.6 21.4 8.2 16.5 8.5C11.7 8.8 8 12.6 7.8 17.3C5.6 18.1 4 20.1 4 22.5C4 25 6.2 27 8.8 27H11.5Z"
            className="fill-slate-500/15 stroke-slate-600 dark:stroke-slate-300"
            strokeWidth="2"
            strokeLinejoin="round"
          />
        </svg>
      );

    case 'wlc':
      return (
        <svg viewBox="0 0 36 36" fill="none" className={className} aria-hidden="true">
          <rect
            x="4"
            y="10"
            width="28"
            height="16"
            rx="4"
            className="fill-teal-600/15 stroke-teal-600 dark:stroke-teal-400"
            strokeWidth="2"
          />
          <path
            d="M12 20.5C13.6 18.9 15.7 18 18 18C20.3 18 22.4 18.9 24 20.5M14.8 22.5C15.7 21.6 16.8 21.1 18 21.1C19.2 21.1 20.3 21.6 21.2 22.5M9.5 17.5C11.8 15.2 14.8 14 18 14C21.2 14 24.2 15.2 26.5 17.5"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </svg>
      );

    case 'access-point':
      return (
        <svg viewBox="0 0 36 36" fill="none" className={className} aria-hidden="true">
          <circle
            cx="18"
            cy="22"
            r="4"
            className="fill-emerald-600/20 stroke-emerald-600 dark:stroke-emerald-400"
            strokeWidth="2"
          />
          <path
            d="M11.5 17.5C13.3 15.7 15.5 14.8 18 14.8C20.5 14.8 22.7 15.7 24.5 17.5M7.5 13.5C10.3 10.7 14 9.2 18 9.2C22 9.2 25.7 10.7 28.5 13.5M18 26V31"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>
      );

    case 'server':
      return (
        <svg viewBox="0 0 36 36" fill="none" className={className} aria-hidden="true">
          <rect
            x="7"
            y="5"
            width="22"
            height="11"
            rx="2.5"
            className="fill-slate-600/15 stroke-slate-700 dark:stroke-slate-300"
            strokeWidth="1.9"
          />
          <rect
            x="7"
            y="20"
            width="22"
            height="11"
            rx="2.5"
            className="fill-slate-600/15 stroke-slate-700 dark:stroke-slate-300"
            strokeWidth="1.9"
          />
          <circle cx="12" cy="10.5" r="1.4" fill="currentColor" />
          <circle cx="12" cy="25.5" r="1.4" fill="currentColor" />
          <path d="M17 10.5H25M17 25.5H25" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
        </svg>
      );

    case 'workstation':
      return (
        <svg viewBox="0 0 36 36" fill="none" className={className} aria-hidden="true">
          <rect
            x="5"
            y="7"
            width="26"
            height="17"
            rx="2.5"
            className="fill-slate-500/15 stroke-slate-600 dark:stroke-slate-300"
            strokeWidth="2"
          />
          <path
            d="M14 24V29M22 24V29M10.5 29H25.5"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      );
  }
};
