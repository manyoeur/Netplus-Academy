import { UserRole } from '../types';

export type ShortcutCategory = 'navigation' | 'tools' | 'admin' | 'workspace';

export type ManagementSubTabId =
  | 'courses'
  | 'progress'
  | 'accounts'
  | 'invite-instructors'
  | 'invite-students';

export interface KeyboardShortcutDef {
  id: string;
  key: string; // lowercase single key (e.g. 'c', 'd', 'l', '?') or combo identifier
  displayKey: string; // display label e.g. 'C', 'D', 'L', '⌘K'
  label: string;
  description: string;
  category: ShortcutCategory;
  tabId?: string;
  managementSubTab?: ManagementSubTabId;
  roles?: UserRole[];
  actionType: 'navigate' | 'help' | 'system';
}

export const KEYBOARD_SHORTCUTS_STORAGE_KEY = 'netpulse_keyboard_shortcuts_enabled_v1';

export const GLOBAL_KEYBOARD_SHORTCUTS: KeyboardShortcutDef[] = [
  // Primary Navigation Tabs
  {
    id: 'nav-courses',
    key: 'c',
    displayKey: 'C',
    label: 'Courses',
    description: 'Open Course Catalog & Syllabus',
    category: 'navigation',
    tabId: 'courses',
    actionType: 'navigate'
  },
  {
    id: 'nav-dashboard',
    key: 'd',
    displayKey: 'D',
    label: 'Dashboard',
    description: 'Switch to Student Learning Dashboard',
    category: 'navigation',
    tabId: 'dashboard',
    actionType: 'navigate'
  },
  {
    id: 'nav-lab',
    key: 'l',
    displayKey: 'L',
    label: 'Lab Simulator',
    description: 'Launch Network Topology & Cisco CLI Lab',
    category: 'navigation',
    tabId: 'lab-sandbox',
    actionType: 'navigate'
  },
  {
    id: 'nav-certificates',
    key: 'e',
    displayKey: 'E',
    label: 'Certificates',
    description: 'View Earned Credentials & Certificate Registry',
    category: 'navigation',
    tabId: 'certificates',
    actionType: 'navigate'
  },
  {
    id: 'nav-forum',
    key: 'm',
    displayKey: 'M',
    label: 'Discussion Forum',
    description: 'Open Network Engineers Q&A Forum',
    category: 'navigation',
    tabId: 'forum',
    actionType: 'navigate'
  },

  // Hands-On Labs & Calculators
  {
    id: 'tool-lab-exercises',
    key: 'x',
    displayKey: 'X',
    label: 'Lab Exercises',
    description: 'Open Networking Lab Exercises & Configuration Guides',
    category: 'tools',
    tabId: 'lab-exercises',
    actionType: 'navigate'
  },
  {
    id: 'tool-network-designer',
    key: 't',
    displayKey: 'T',
    label: 'Network Designer',
    description: 'Open Visio-style Network Diagram & Topology Studio',
    category: 'tools',
    tabId: 'network-designer',
    actionType: 'navigate'
  },
  {
    id: 'tool-subnet',
    key: 's',
    displayKey: 'S',
    label: 'Subnet & VLSM',
    description: 'Open Subnetting & VLSM Architecture Calculator',
    category: 'tools',
    tabId: 'subnet-calc',
    actionType: 'navigate'
  },
  {
    id: 'tool-base',
    key: 'b',
    displayKey: 'B',
    label: 'Base Converter',
    description: 'Open Binary, Decimal & Hexadecimal Converter',
    category: 'tools',
    tabId: 'base-converter',
    actionType: 'navigate'
  },
  {
    id: 'tool-binary-game',
    key: 'g',
    displayKey: 'G',
    label: 'Binary Game',
    description: 'Open Binary Conversion Practice Game',
    category: 'tools',
    tabId: 'binary-game',
    actionType: 'navigate'
  },

  // Administration (Instructors & Admins)
  {
    id: 'admin-my-class',
    key: 'y',
    displayKey: 'Y',
    label: 'My Classes',
    description: 'Open Classes, Attendance & Enrollment Workspace',
    category: 'admin',
    tabId: 'my-class',
    roles: ['admin', 'instructor'],
    actionType: 'navigate'
  },
  {
    id: 'admin-course-manager',
    key: 'p',
    displayKey: 'P',
    label: 'Course Manager',
    description: 'Open Course Content & Curriculum Manager',
    category: 'admin',
    tabId: 'management',
    managementSubTab: 'courses',
    roles: ['admin', 'instructor'],
    actionType: 'navigate'
  },
  {
    id: 'admin-analytics',
    key: 'a',
    displayKey: 'A',
    label: 'Live Analytics',
    description: 'View Real-Time Learner Activity & Telemetry',
    category: 'admin',
    tabId: 'analytics',
    roles: ['admin', 'instructor'],
    actionType: 'navigate'
  },

  // Workspace Controls
  {
    id: 'sys-shortcuts-help',
    key: '?',
    displayKey: '?',
    label: 'Keyboard Shortcuts',
    description: 'Open or close this keyboard shortcuts reference',
    category: 'workspace',
    actionType: 'help'
  },
  {
    id: 'sys-quick-jump',
    key: 'mod+k',
    displayKey: 'Ctrl+K',
    label: 'Quick Jump Search',
    description: 'Open global command palette search (Cmd/Ctrl + K)',
    category: 'workspace',
    actionType: 'system'
  },
  {
    id: 'sys-toggle-sidebar',
    key: 'mod+b',
    displayKey: 'Ctrl+B',
    label: 'Toggle Sidebar Pin',
    description: 'Pin or unpin the navigation sidebar (Cmd/Ctrl + B)',
    category: 'workspace',
    actionType: 'system'
  }
];

export function getShortcutsForRole(role: UserRole): KeyboardShortcutDef[] {
  return GLOBAL_KEYBOARD_SHORTCUTS.filter(
    shortcut => !shortcut.roles || shortcut.roles.includes(role)
  );
}

export function getTabShortcutHint(tabId: string, role: UserRole): string | null {
  const match = getShortcutsForRole(role).find(
    s => s.actionType === 'navigate' && s.tabId === tabId
  );
  return match ? match.displayKey : null;
}

export function isEditableElement(target: EventTarget | null): boolean {
  if (!target || !(target instanceof HTMLElement)) return false;
  const tagName = target.tagName;
  if (tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT') {
    return true;
  }
  if (target.isContentEditable) return true;
  if (
    target.closest('[contenteditable="true"]') ||
    target.closest('[role="textbox"]') ||
    target.closest('[data-disable-global-shortcuts="true"]')
  ) {
    return true;
  }
  return false;
}

export function loadShortcutsEnabled(): boolean {
  try {
    const raw = localStorage.getItem(KEYBOARD_SHORTCUTS_STORAGE_KEY);
    return raw === null ? true : raw === 'true';
  } catch {
    return true;
  }
}

export function saveShortcutsEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(KEYBOARD_SHORTCUTS_STORAGE_KEY, String(enabled));
  } catch {
    // Ignore storage quota errors
  }
}
