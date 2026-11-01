import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCodeSage } from '../context/CodeSageContext';

export interface ShortcutItem {
  id: string;
  category: 'Navigation' | 'Repository' | 'Command Palette' | 'General';
  label: string;
  description: string;
  keys: string[];
  action: () => void;
}

export function isMacOs(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /(Mac|iPhone|iPod|iPad)/i.test(navigator.platform || navigator.userAgent);
}

export const MODIFIER_LABEL = isMacOs() ? '⌘' : 'Ctrl';
export const ALT_LABEL = isMacOs() ? '⌥' : 'Alt';

export function useKeyboardShortcuts() {
  const navigate = useNavigate();
  const {
    activeRepo,
    repositories,
    selectRepository,
    searchModalOpen,
    setSearchModalOpen,
    ingestModalOpen,
    setIngestModalOpen,
    shortcutsModalOpen,
    setShortcutsModalOpen,
    sidebarCollapsed,
    setSidebarCollapsed,
    triggerShortcutToast,
  } = useCodeSage();

  const isMac = useMemo(() => isMacOs(), []);
  const modKey = isMac ? '⌘' : 'Ctrl';

  const selectNextRepo = () => {
    if (repositories.length <= 1) return;
    const currentIndex = repositories.findIndex((r) => r.id === activeRepo?.id);
    const nextIndex = (currentIndex + 1) % repositories.length;
    const nextRepo = repositories[nextIndex];
    selectRepository(nextRepo.id);
    triggerShortcutToast(`Switched to ${nextRepo.name}`, `${modKey}]`);
  };

  const selectPrevRepo = () => {
    if (repositories.length <= 1) return;
    const currentIndex = repositories.findIndex((r) => r.id === activeRepo?.id);
    const prevIndex = (currentIndex - 1 + repositories.length) % repositories.length;
    const prevRepo = repositories[prevIndex];
    selectRepository(prevRepo.id);
    triggerShortcutToast(`Switched to ${prevRepo.name}`, `${modKey}[`);
  };

  const shortcuts: ShortcutItem[] = useMemo(() => {
    return [
      {
        id: 'command-palette',
        category: 'Command Palette',
        label: 'Open Command Palette & Search',
        description: 'Fuzzy search files, AST symbols, API endpoints, and workspace routes',
        keys: [modKey, 'K'],
        action: () => {
          setSearchModalOpen(!searchModalOpen);
          if (!searchModalOpen) {
            setShortcutsModalOpen(false);
            setIngestModalOpen(false);
          }
        },
      },
      {
        id: 'nav-graph',
        category: 'Navigation',
        label: 'Go to Knowledge Graph',
        description: 'Open interactive 3D node galaxy architecture graph',
        keys: [modKey, 'G'],
        action: () => {
          navigate('/graph');
          triggerShortcutToast('Navigated to Knowledge Graph', `${modKey}G`);
        },
      },
      {
        id: 'nav-explorer',
        category: 'Navigation',
        label: 'Go to Repository Explorer',
        description: 'Inspect indexed source files, line metrics, AST symbols, and syntax',
        keys: [modKey, 'E'],
        action: () => {
          navigate('/explorer');
          triggerShortcutToast('Navigated to Repository Explorer', `${modKey}E`);
        },
      },
      {
        id: 'nav-ask',
        category: 'Navigation',
        label: 'Go to Ask CodeSage',
        description: 'Ask architectural questions with verified GraphRAG source citations',
        keys: [modKey, 'J'],
        action: () => {
          navigate('/ask');
          triggerShortcutToast('Navigated to Ask CodeSage', `${modKey}J`);
        },
      },
      {
        id: 'nav-dependencies',
        category: 'Navigation',
        label: 'Go to Dependencies & Blast Radius',
        description: 'Analyze transitive dependency paths and change impact blast radius',
        keys: [modKey, 'D'],
        action: () => {
          navigate('/dependencies');
          triggerShortcutToast('Navigated to Dependencies Analysis', `${modKey}D`);
        },
      },
      {
        id: 'nav-bugs',
        category: 'Navigation',
        label: 'Go to Bug Detective',
        description: 'Evidence-grounded root cause analysis and stack trace triage',
        keys: [modKey, 'U'],
        action: () => {
          navigate('/bugs');
          triggerShortcutToast('Navigated to Bug Detective', `${modKey}U`);
        },
      },
      {
        id: 'nav-explainer',
        category: 'Navigation',
        label: 'Go to Code Explainer',
        description: 'Split-screen architectural breakdown of functions and modules',
        keys: [modKey, 'X'],
        action: () => {
          navigate('/explainer');
          triggerShortcutToast('Navigated to Code Explainer', `${modKey}X`);
        },
      },
      {
        id: 'nav-apiflow',
        category: 'Navigation',
        label: 'Go to API Flow',
        description: 'Multi-tier request visualizer from frontend to database',
        keys: [modKey, 'F'],
        action: () => {
          navigate('/apiflow');
          triggerShortcutToast('Navigated to API Flow', `${modKey}F`);
        },
      },
      {
        id: 'nav-docs',
        category: 'Navigation',
        label: 'Go to Documentation Studio',
        description: 'Synthesize and export ADRs, API specs, and security profiles',
        keys: [modKey, 'O'],
        action: () => {
          navigate('/docs');
          triggerShortcutToast('Navigated to Documentation Studio', `${modKey}O`);
        },
      },
      {
        id: 'nav-history',
        category: 'Navigation',
        label: 'Go to Investigation History',
        description: 'Browse saved rationale findings and past investigations',
        keys: [modKey, 'Y'],
        action: () => {
          navigate('/history');
          triggerShortcutToast('Navigated to Investigation History', `${modKey}Y`);
        },
      },
      {
        id: 'nav-analysis',
        category: 'Navigation',
        label: 'Go to Code Analysis',
        description: 'View architecture findings, cyclomatic hotspots, and test coverage',
        keys: [modKey, 'M'],
        action: () => {
          navigate('/analysis');
          triggerShortcutToast('Navigated to Code Analysis', `${modKey}M`);
        },
      },
      {
        id: 'nav-home',
        category: 'Navigation',
        label: 'Go to Home Workspace',
        description: 'Return to 3D Neural Core hero workspace and recent analysis stream',
        keys: [modKey, 'H'],
        action: () => {
          navigate('/');
          triggerShortcutToast('Navigated to Home Workspace', `${modKey}H`);
        },
      },
      {
        id: 'nav-settings',
        category: 'Navigation',
        label: 'Go to Settings & Diagnostics',
        description: 'Inspect LLM reasoning status, Neo4j, Sarvam, and system telemetry',
        keys: [modKey, ','],
        action: () => {
          navigate('/settings');
          triggerShortcutToast('Navigated to Settings', `${modKey},`);
        },
      },
      {
        id: 'repo-import',
        category: 'Repository',
        label: 'Import Repository',
        description: 'Connect a public GitHub repo or upload a ZIP archive for AST indexing',
        keys: [modKey, 'I'],
        action: () => {
          setIngestModalOpen(true);
          setSearchModalOpen(false);
          setShortcutsModalOpen(false);
          triggerShortcutToast('Import Repository Dialog', `${modKey}I`);
        },
      },
      {
        id: 'repo-next',
        category: 'Repository',
        label: 'Next Repository',
        description: 'Cycle to the next indexed repository in your workspace',
        keys: [modKey, ']'],
        action: selectNextRepo,
      },
      {
        id: 'repo-prev',
        category: 'Repository',
        label: 'Previous Repository',
        description: 'Cycle to the previous indexed repository in your workspace',
        keys: [modKey, '['],
        action: selectPrevRepo,
      },
      {
        id: 'toggle-sidebar',
        category: 'General',
        label: 'Toggle Sidebar',
        description: 'Expand or collapse the left navigation panel for extra screen width',
        keys: [modKey, 'B'],
        action: () => {
          setSidebarCollapsed((prev) => !prev);
          triggerShortcutToast(
            sidebarCollapsed ? 'Sidebar Expanded' : 'Sidebar Collapsed',
            `${modKey}B`
          );
        },
      },
      {
        id: 'shortcuts-cheat-sheet',
        category: 'General',
        label: 'Show Keyboard Shortcuts',
        description: 'Display this master keyboard shortcut reference modal',
        keys: ['?'],
        action: () => {
          setShortcutsModalOpen(!shortcutsModalOpen);
        },
      },
      {
        id: 'shortcuts-cheat-sheet-alt',
        category: 'General',
        label: 'Show Keyboard Shortcuts (Alternate)',
        description: 'Display this master keyboard shortcut reference modal',
        keys: [modKey, '/'],
        action: () => {
          setShortcutsModalOpen(!shortcutsModalOpen);
        },
      },
    ];
  }, [
    modKey,
    searchModalOpen,
    shortcutsModalOpen,
    sidebarCollapsed,
    repositories,
    activeRepo,
    navigate,
  ]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isInput =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable);

      // Handle Escape globally to dismiss modals
      if (e.key === 'Escape') {
        if (searchModalOpen || ingestModalOpen || shortcutsModalOpen) {
          e.preventDefault();
          setSearchModalOpen(false);
          setIngestModalOpen(false);
          setShortcutsModalOpen(false);
          return;
        }
      }

      // Check modifier combinations (Meta on Mac, Ctrl on Win/Linux)
      const hasModifier = isMac ? e.metaKey : e.ctrlKey;

      if (hasModifier && !e.altKey) {
        const key = e.key.toLowerCase();

        if (key === 'k') {
          e.preventDefault();
          setSearchModalOpen(!searchModalOpen);
          return;
        }

        if (key === 'g') {
          e.preventDefault();
          navigate('/graph');
          triggerShortcutToast('Navigated to Knowledge Graph', `${modKey}G`);
          return;
        }

        if (key === 'e') {
          e.preventDefault();
          navigate('/explorer');
          triggerShortcutToast('Navigated to Repository Explorer', `${modKey}E`);
          return;
        }

        if (key === 'j') {
          e.preventDefault();
          navigate('/ask');
          triggerShortcutToast('Navigated to Ask CodeSage', `${modKey}J`);
          return;
        }

        if (key === 'd') {
          e.preventDefault();
          navigate('/dependencies');
          triggerShortcutToast('Navigated to Dependencies Analysis', `${modKey}D`);
          return;
        }

        if (key === 'm') {
          e.preventDefault();
          navigate('/analysis');
          triggerShortcutToast('Navigated to Code Analysis', `${modKey}M`);
          return;
        }

        if (key === 'u') {
          e.preventDefault();
          navigate('/bugs');
          triggerShortcutToast('Navigated to Bug Detective', `${modKey}U`);
          return;
        }

        if (key === 'x') {
          e.preventDefault();
          navigate('/explainer');
          triggerShortcutToast('Navigated to Code Explainer', `${modKey}X`);
          return;
        }

        if (key === 'f') {
          e.preventDefault();
          navigate('/apiflow');
          triggerShortcutToast('Navigated to API Flow', `${modKey}F`);
          return;
        }

        if (key === 'o') {
          e.preventDefault();
          navigate('/docs');
          triggerShortcutToast('Navigated to Documentation Studio', `${modKey}O`);
          return;
        }

        if (key === 'y') {
          e.preventDefault();
          navigate('/history');
          triggerShortcutToast('Navigated to Investigation History', `${modKey}Y`);
          return;
        }

        if (key === 'h') {
          e.preventDefault();
          navigate('/');
          triggerShortcutToast('Navigated to Home Workspace', `${modKey}H`);
          return;
        }

        if (key === ',') {
          e.preventDefault();
          navigate('/settings');
          triggerShortcutToast('Navigated to Settings', `${modKey},`);
          return;
        }

        if (key === 'i') {
          e.preventDefault();
          setIngestModalOpen(true);
          setSearchModalOpen(false);
          setShortcutsModalOpen(false);
          triggerShortcutToast('Import Repository Dialog', `${modKey}I`);
          return;
        }

        if (key === 'b') {
          e.preventDefault();
          setSidebarCollapsed((prev) => !prev);
          triggerShortcutToast(
            sidebarCollapsed ? 'Sidebar Expanded' : 'Sidebar Collapsed',
            `${modKey}B`
          );
          return;
        }

        if (key === ']') {
          e.preventDefault();
          selectNextRepo();
          return;
        }

        if (key === '[') {
          e.preventDefault();
          selectPrevRepo();
          return;
        }

        if (key === '/') {
          e.preventDefault();
          setShortcutsModalOpen(!shortcutsModalOpen);
          return;
        }
      }

      // Single-key shortcuts (only when not typing in text fields)
      if (!isInput && !hasModifier && !e.altKey && !e.metaKey && !e.ctrlKey) {
        if (e.key === '?' || (e.shiftKey && e.key === '/')) {
          e.preventDefault();
          setShortcutsModalOpen(!shortcutsModalOpen);
          return;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    isMac,
    modKey,
    searchModalOpen,
    ingestModalOpen,
    shortcutsModalOpen,
    sidebarCollapsed,
    repositories,
    activeRepo,
    navigate,
  ]);

  return {
    shortcuts,
    modKey,
    isMac,
    shortcutsModalOpen,
    setShortcutsModalOpen,
  };
}
