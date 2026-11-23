import { useEffect } from 'react';
import { UserRole } from '../types';
import {
  KeyboardShortcutDef,
  ManagementSubTabId,
  getShortcutsForRole,
  isEditableElement
} from '../utils/keyboardShortcuts';

interface UseKeyboardShortcutsOptions {
  enabled: boolean;
  isAuthenticated: boolean;
  userRole: UserRole;
  isModalOpen?: boolean;
  isShortcutsModalOpen: boolean;
  onNavigateTab: (tabId: string) => void;
  onSelectManagementTab: (subTab: ManagementSubTabId) => void;
  onToggleShortcutsModal: () => void;
  onCloseShortcutsModal: () => void;
  onShortcutTriggered?: (shortcut: KeyboardShortcutDef) => void;
}

export function useKeyboardShortcuts({
  enabled,
  isAuthenticated,
  userRole,
  isModalOpen = false,
  isShortcutsModalOpen,
  onNavigateTab,
  onSelectManagementTab,
  onToggleShortcutsModal,
  onCloseShortcutsModal,
  onShortcutTriggered
}: UseKeyboardShortcutsOptions): void {
  useEffect(() => {
    if (!isAuthenticated) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.repeat || e.isComposing) return;

      // Never intercept browser or command-palette modifier combinations (Cmd/Ctrl/Alt)
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      // Close shortcuts reference modal on Escape
      if (e.key === 'Escape' && isShortcutsModalOpen) {
        e.preventDefault();
        onCloseShortcutsModal();
        return;
      }

      // Never fire while user is typing in any input, textarea, select, or CLI terminal
      if (isEditableElement(e.target) || isEditableElement(document.activeElement)) {
        return;
      }

      // Pause navigation shortcuts while another dialog/drawer is open
      const hasOpenDialog = Boolean(
        document.querySelector('[role="dialog"][aria-modal="true"]')
      );

      // '?' opens/closes the keyboard shortcuts reference modal
      if (e.key === '?' && (!isModalOpen || isShortcutsModalOpen) && (!hasOpenDialog || isShortcutsModalOpen)) {
        e.preventDefault();
        onToggleShortcutsModal();
        return;
      }

      if (!enabled || isModalOpen || isShortcutsModalOpen || hasOpenDialog) {
        return;
      }

      // Single-letter navigation shortcuts must not collide with shifted uppercase selection/combos
      if (e.shiftKey) return;

      const pressedKey = e.key.toLowerCase();
      if (!pressedKey || pressedKey.length !== 1) return;

      // Respect BinaryGame's in-round 'C' (Clear Bits) shortcut while playing
      if (
        pressedKey === 'c' &&
        document.querySelector('[data-active-binary-game="true"]')
      ) {
        return;
      }

      const roleShortcuts = getShortcutsForRole(userRole);
      const matched = roleShortcuts.find(
        item => item.actionType === 'navigate' && item.key === pressedKey && item.tabId
      );

      if (!matched || !matched.tabId) return;

      e.preventDefault();

      if (matched.tabId === 'management' && matched.managementSubTab) {
        onSelectManagementTab(matched.managementSubTab);
      } else {
        onNavigateTab(matched.tabId);
      }

      onShortcutTriggered?.(matched);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    enabled,
    isAuthenticated,
    userRole,
    isModalOpen,
    isShortcutsModalOpen,
    onNavigateTab,
    onSelectManagementTab,
    onToggleShortcutsModal,
    onCloseShortcutsModal,
    onShortcutTriggered
  ]);
}
