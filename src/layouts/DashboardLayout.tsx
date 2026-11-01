import React, { useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  BarChart3,
  BookOpen,
  Bug,
  ChevronLeft,
  ChevronRight,
  FileText,
  FolderGit2,
  FolderTree,
  GitFork,
  Globe,
  History,
  Home,
  Keyboard,
  Menu,
  MessageSquareCode,
  Mic,
  Network,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Route,
  Search,
  Settings,
  Sparkles,
  X,
} from 'lucide-react';
import { useCodeSage } from '../context/CodeSageContext';
import { IngestRepoModal } from '../components/modals/IngestRepoModal';
import { GlobalSearchModal } from '../components/modals/GlobalSearchModal';
import { KeyboardShortcutsModal } from '../components/modals/KeyboardShortcutsModal';
import { ShortcutHUDToast } from '../components/common/ShortcutHUDToast';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import teamAvatarUrl from '../assets/images/avatar_innovation_ninjas_1793120688787.jpg';

import { VoiceAIAssistantModal } from '../components/common/VoiceAIAssistantModal';
import { SUPPORTED_LANGUAGES, type LanguageCode } from '../types';

const NAV_ITEMS = [
  { to: '/', label: 'Overview', icon: Home, end: true, shortcut: 'H' },
  { to: '/ask', label: 'AI Assistant', icon: MessageSquareCode, shortcut: 'J' },
  { to: '/explorer', label: 'Repository Explorer', icon: FolderTree, shortcut: 'E' },
  { to: '/graph', label: 'Knowledge Graph', icon: Network, shortcut: 'G' },
  { to: '/dependencies', label: 'Dependency Lab', icon: GitFork, shortcut: 'D' },
  { to: '/bugs', label: 'Bug Detective', icon: Bug, shortcut: 'B' },
  { to: '/explainer', label: 'Code Explainer', icon: BookOpen, shortcut: 'X' },
  { to: '/apiflow', label: 'API Flow', icon: Route, shortcut: 'F' },
  { to: '/docs', label: 'Documentation Studio', icon: FileText, shortcut: 'O' },
  { to: '/history', label: 'Investigation History', icon: History, shortcut: 'Y' },
  { to: '/settings', label: 'Settings', icon: Settings, shortcut: ',' },
];

export const DashboardLayout: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    health,
    repositories,
    activeRepo,
    selectRepository,
    setIngestModalOpen,
    setSearchModalOpen,
    setShortcutsModalOpen,
    sidebarCollapsed,
    setSidebarCollapsed,
    language,
    setLanguage,
  } = useCodeSage();

  const { modKey } = useKeyboardShortcuts();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [avatarFailed, setAvatarFailed] = useState(false);
  const [voiceModalOpen, setVoiceModalOpen] = useState(false);

  return (
    <div className="min-h-screen flex flex-col bg-[#020817] text-slate-100">
      {/* Top Bar: Clean 3-Zone Contract */}
      <header className="sticky top-0 z-30 h-15 flex items-center justify-between gap-6 px-4 lg:px-6 border-b border-slate-800/80 bg-[#041126]/95 backdrop-blur-md">
        {/* Zone 1: Brand Wordmark + Universal Sidebar Toggle */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <button
            type="button"
            onClick={() => {
              if (typeof window !== 'undefined' && window.innerWidth < 768) {
                setMobileMenuOpen((v) => !v);
              } else {
                setSidebarCollapsed((c) => !c);
              }
            }}
            className="p-2 rounded-lg text-slate-300 hover:text-white hover:bg-[#0A2042] transition-colors cursor-pointer"
            title={
              sidebarCollapsed
                ? `Expand Sidebar (${modKey}B)`
                : `Collapse Sidebar (${modKey}B)`
            }
            aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {sidebarCollapsed ? (
              <PanelLeftOpen className="w-5 h-5 text-cyan-400" />
            ) : (
              <PanelLeftClose className="w-5 h-5 text-slate-300 hover:text-cyan-300" />
            )}
          </button>

          <Link
            to="/"
            className="flex items-center gap-2.5 text-base sm:text-lg font-bold tracking-tight text-white whitespace-nowrap shrink-0"
          >
            <svg
              viewBox="0 0 32 32"
              className="w-7 h-7 shrink-0"
              fill="none"
              aria-hidden="true"
            >
              <rect width="32" height="32" rx="8" fill="#0A2042" />
              <path
                d="M16 5L25.5 10.5V21.5L16 27L6.5 21.5V10.5L16 5Z"
                stroke="#2563FF"
                strokeWidth="2"
              />
              <circle cx="16" cy="11" r="2.2" fill="#22D3EE" />
              <circle cx="11" cy="19.5" r="2.2" fill="#793CFF" />
              <circle cx="21" cy="19.5" r="2.2" fill="#22D3EE" />
              <path
                d="M16 13.2L11.8 17.8M16 13.2L20.2 17.8M13.2 19.5H18.8"
                stroke="#60A5FA"
                strokeWidth="1.5"
              />
            </svg>
            <span>CodeSage AI</span>
          </Link>
        </div>

        {/* Zone 2: Clean Single-Line Navigation Links */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-300">
          <Link
            to="/ask"
            className={`hover:text-white transition-colors whitespace-nowrap shrink-0 ${
              location.pathname === '/ask' ? 'text-cyan-300' : ''
            }`}
          >
            Understand
          </Link>
          <Link
            to="/graph"
            className={`hover:text-white transition-colors whitespace-nowrap shrink-0 ${
              location.pathname === '/graph' || location.pathname === '/explorer'
                ? 'text-cyan-300'
                : ''
            }`}
          >
            Explore
          </Link>
          <Link
            to="/dependencies"
            className={`hover:text-white transition-colors whitespace-nowrap shrink-0 ${
              location.pathname === '/dependencies' || location.pathname === '/analysis'
                ? 'text-cyan-300'
                : ''
            }`}
          >
            Build
          </Link>
          <Link
            to="/settings"
            className={`hover:text-white transition-colors whitespace-nowrap shrink-0 ${
              location.pathname === '/settings' ? 'text-cyan-300' : ''
            }`}
          >
            Diagnostics
          </Link>
        </nav>

        {/* Zone 3: Workspace Controls & Primary Action */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Global Search / Command Palette Trigger (⌘K / Ctrl+K) */}
          <button
            type="button"
            onClick={() => setSearchModalOpen(true)}
            className="hidden sm:inline-flex items-center gap-2.5 px-3 py-1.5 rounded-lg bg-[#020817] hover:bg-[#0A2042] border border-slate-800 text-xs text-slate-400 hover:text-slate-200 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            aria-label="Open global command palette and search"
          >
            <Search className="w-3.5 h-3.5 text-cyan-400" />
            <span>Search repo...</span>
            <kbd className="px-1.5 py-0.5 text-[10px] font-mono bg-[#071A35] text-slate-300 rounded border border-slate-700">
              {modKey} K
            </kbd>
          </button>

          {/* Master Keyboard Shortcuts Cheat Sheet Button */}
          <button
            type="button"
            onClick={() => setShortcutsModalOpen(true)}
            className="hidden md:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#020817] hover:bg-[#0A2042] border border-slate-800 text-xs text-slate-400 hover:text-slate-200 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            title={`Keyboard Shortcuts (? or ${modKey}/)`}
            aria-label="Open keyboard shortcuts cheat sheet"
          >
            <Keyboard className="w-3.5 h-3.5 text-cyan-300" />
            <kbd className="px-1.5 py-0.5 text-[10px] font-mono bg-[#071A35] text-slate-300 rounded border border-slate-700">
              ?
            </kbd>
          </button>

          {/* Voice AI Assistant Trigger */}
          <button
            type="button"
            onClick={() => setVoiceModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#071A35] hover:bg-[#0A2042] border border-cyan-500/40 text-xs font-medium text-cyan-200 hover:text-white transition-all shadow-sm shadow-cyan-500/10 cursor-pointer"
            title="Voice AI Assistant (Microphone Q&A)"
          >
            <Mic className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
            <span className="hidden lg:inline">Voice AI</span>
          </button>

          {/* Multilingual Selector */}
          <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#020817] border border-slate-800">
            <Globe className="w-3.5 h-3.5 text-cyan-300 shrink-0" />
            <label htmlFor="header-lang-select" className="sr-only">
              Workspace Language
            </label>
            <select
              id="header-lang-select"
              value={language}
              onChange={(e) => setLanguage(e.target.value as LanguageCode)}
              className="bg-transparent text-xs font-medium text-slate-200 focus:outline-none cursor-pointer"
            >
              {SUPPORTED_LANGUAGES.map((l) => (
                <option key={l.code} value={l.code} className="bg-[#041126] text-slate-100">
                  {l.nativeLabel}
                </option>
              ))}
            </select>
          </div>

          {/* Repository Selector & Branch Indicator */}
          <div className="hidden xl:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#020817] border border-slate-800">
            <FolderGit2 className="w-3.5 h-3.5 text-[#60A5FA] shrink-0" />
            <span className="text-[10px] font-mono px-1 py-0.2 rounded bg-[#0A2042] text-cyan-300 border border-slate-700">
              main
            </span>
            <label htmlFor="header-repo-select" className="sr-only">
              Active Repository
            </label>
            <select
              id="header-repo-select"
              value={activeRepo?.id || ''}
              onChange={(e) => selectRepository(e.target.value)}
              className="bg-transparent text-xs font-mono text-slate-200 focus:outline-none max-w-[190px] truncate cursor-pointer"
            >
              {repositories.map((repo) => (
                <option key={repo.id} value={repo.id} className="bg-[#041126] text-slate-100">
                  {repo.fullName} {repo.isSample ? '(Sample)' : '(Live)'}
                </option>
              ))}
            </select>
          </div>

          {/* Primary Action: Import Repository */}
          <button
            type="button"
            onClick={() => setIngestModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#2563FF] hover:bg-[#1d4ed8] text-xs font-medium text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer shadow-md shadow-[#2563FF]/20"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Import Repo</span>
          </button>

          {/* Team Profile Button */}
          <button
            type="button"
            onClick={() => navigate('/settings')}
            className="hidden sm:flex items-center gap-2 pl-2 border-l border-slate-800 text-left cursor-pointer group"
            title="Team INNOVATION NINJAS — Settings & Diagnostics"
          >
            {avatarFailed ? (
              <div className="w-7 h-7 rounded-full bg-[#2563FF]/30 border border-[#2563FF] flex items-center justify-center text-[10px] font-bold text-cyan-200 shrink-0">
                IN
              </div>
            ) : (
              <img
                src={teamAvatarUrl}
                alt="INNOVATION NINJAS emblem"
                referrerPolicy="no-referrer"
                onError={() => setAvatarFailed(true)}
                className="w-7 h-7 rounded-full object-cover border border-slate-700 shrink-0"
              />
            )}
            <span className="hidden 2xl:inline text-xs font-medium text-slate-300 group-hover:text-white whitespace-nowrap">
              INNOVATION NINJAS
            </span>
          </button>
        </div>
      </header>

      {/* Workspace Body: Sidebar + Main Viewport */}
      <div className="flex-1 flex min-h-0 relative">
        {/* Mobile Drawer Backdrop (closes on click) */}
        {mobileMenuOpen && (
          <div
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-xs md:hidden"
            onClick={() => setMobileMenuOpen(false)}
            aria-hidden="true"
          />
        )}

        {/* Collapsible Persistent Sidebar (Desktop & Tablet >= 768px) / Slide-Out Drawer (Mobile < 768px) */}
        <aside
          className={`
            ${
              mobileMenuOpen
                ? 'fixed top-0 bottom-0 left-0 z-50 flex w-72 shadow-2xl shadow-black/80'
                : 'hidden md:flex'
            }
            ${sidebarCollapsed ? 'md:w-16' : 'md:w-64'}
            flex-col justify-between bg-[#041126] border-r border-slate-800/80 shrink-0 transition-[width] duration-200 ease-in-out
          `}
        >
          {/* Mobile Drawer Header with Close Button */}
          {mobileMenuOpen && (
            <div className="md:hidden flex items-center justify-between p-3.5 border-b border-slate-800/80 bg-[#071A35]">
              <div className="flex items-center gap-2">
                <svg
                  viewBox="0 0 32 32"
                  className="w-6 h-6 shrink-0"
                  fill="none"
                  aria-hidden="true"
                >
                  <rect width="32" height="32" rx="8" fill="#0A2042" />
                  <path
                    d="M16 5L25.5 10.5V21.5L16 27L6.5 21.5V10.5L16 5Z"
                    stroke="#2563FF"
                    strokeWidth="2"
                  />
                  <circle cx="16" cy="11" r="2.2" fill="#22D3EE" />
                  <circle cx="11" cy="19.5" r="2.2" fill="#793CFF" />
                  <circle cx="21" cy="19.5" r="2.2" fill="#22D3EE" />
                </svg>
                <span className="text-sm font-bold text-white">CodeSage AI</span>
              </div>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-[#0A2042] cursor-pointer"
                aria-label="Close navigation drawer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          )}

          <div className="p-3 space-y-4 overflow-y-auto">
            {/* Repo Switcher: Shown in mobile drawer or when expanded on viewports under xl */}
            {(!sidebarCollapsed || mobileMenuOpen) && (
              <div className="xl:hidden px-1">
                <label htmlFor="sidebar-repo-select" className="block text-[11px] font-medium text-slate-400 mb-1">
                  Active Repository
                </label>
                <select
                  id="sidebar-repo-select"
                  value={activeRepo?.id || ''}
                  onChange={(e) => {
                    selectRepository(e.target.value);
                    setMobileMenuOpen(false);
                  }}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-[#020817] border border-slate-800 text-xs font-mono text-slate-200 cursor-pointer focus:border-[#2563FF] focus:outline-none"
                >
                  {repositories.map((repo) => (
                    <option key={repo.id} value={repo.id} className="bg-[#041126]">
                      {repo.name} {repo.isSample ? '(Sample)' : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Primary Navigation */}
            <nav className="space-y-1" aria-label="Workspace navigation">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    onClick={() => setMobileMenuOpen(false)}
                    title={
                      sidebarCollapsed
                        ? `${item.label} (${modKey}${item.shortcut})`
                        : undefined
                    }
                    className={({ isActive }) =>
                      `group flex items-center ${
                        sidebarCollapsed ? 'justify-center px-0' : 'justify-between px-3'
                      } py-2.5 rounded-lg text-xs sm:text-sm font-medium transition-colors whitespace-nowrap ${
                        isActive
                          ? 'bg-[#2563FF] text-white shadow-sm shadow-[#2563FF]/30'
                          : 'text-slate-300 hover:text-white hover:bg-[#0A2042]'
                      }`
                    }
                  >
                    <div
                      className={`flex items-center ${
                        sidebarCollapsed ? 'justify-center w-full' : 'gap-3 min-w-0'
                      }`}
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      {!sidebarCollapsed && <span className="truncate">{item.label}</span>}
                    </div>
                    {!sidebarCollapsed && (
                      <kbd className="opacity-0 group-hover:opacity-100 transition-opacity px-1.5 py-0.5 rounded text-[10px] font-mono text-slate-400 group-hover:text-cyan-300 bg-[#020817]/60 border border-slate-700/60">
                        {modKey}{item.shortcut}
                      </kbd>
                    )}
                  </NavLink>
                );
              })}
            </nav>

            {/* Popular / Example Repositories List */}
            {(!sidebarCollapsed || mobileMenuOpen) && (
              <div className="pt-3 border-t border-slate-800/80">
                <div className="flex items-center justify-between px-2 mb-2">
                  <span className="text-[11px] font-medium text-slate-400">
                    Indexed Repositories
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setIngestModalOpen(true);
                      setMobileMenuOpen(false);
                    }}
                    className="text-[11px] text-cyan-300 hover:text-cyan-200 cursor-pointer"
                  >
                    + Add
                  </button>
                </div>
                <div className="space-y-1">
                  {repositories.map((repo) => {
                    const selected = repo.id === activeRepo?.id;
                    return (
                      <button
                        key={repo.id}
                        type="button"
                        onClick={() => {
                          selectRepository(repo.id);
                          setMobileMenuOpen(false);
                        }}
                        className={`w-full px-2.5 py-2 rounded-lg text-left transition-colors cursor-pointer ${
                          selected
                            ? 'bg-[#0A2042] text-white border border-slate-700/80'
                            : 'text-slate-400 hover:text-slate-200 hover:bg-[#071A35]'
                        }`}
                      >
                        <div className="font-mono text-xs truncate">{repo.name}</div>
                        <div className="text-[10px] text-slate-400 mt-0.5 tabular-nums truncate">
                          {repo.isSample ? 'Example · ' : 'Live · '}
                          {repo.fileCount} files · {repo.primaryLanguage}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Build Smarter with AI Callout */}
            {(!sidebarCollapsed || mobileMenuOpen) && (
              <div className="rounded-xl border border-slate-800 bg-[#071A35] p-3.5 space-y-2">
                <div className="text-xs font-semibold text-white">Build Smarter with AI</div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Import any public GitHub URL or .zip archive to generate verified AST citations and dependency blast-radius graphs.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setIngestModalOpen(true);
                    setMobileMenuOpen(false);
                  }}
                  className="w-full py-1.5 px-3 rounded-lg bg-[#0A2042] hover:bg-[#2563FF] text-xs font-medium text-cyan-200 hover:text-white transition-colors cursor-pointer"
                >
                  Analyze Your Repo
                </button>
              </div>
            )}
          </div>

          {/* Desktop/Tablet Collapse Toggle at Bottom */}
          <div
            className={`hidden md:flex items-center ${
              sidebarCollapsed ? 'justify-center' : 'justify-between'
            } p-2.5 border-t border-slate-800/80`}
          >
            {!sidebarCollapsed && (
              <span className="text-[10px] text-slate-500 font-mono pl-1.5">
                Toggle {modKey}B
              </span>
            )}
            <button
              type="button"
              onClick={() => setSidebarCollapsed((c) => !c)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-[#0A2042] transition-colors cursor-pointer"
              title={
                sidebarCollapsed
                  ? `Expand sidebar (${modKey}B)`
                  : `Collapse sidebar (${modKey}B)`
              }
              aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {sidebarCollapsed ? (
                <ChevronRight className="w-4 h-4 text-cyan-400" />
              ) : (
                <ChevronLeft className="w-4 h-4 text-slate-400" />
              )}
            </button>
          </div>
        </aside>

        {/* Main Viewport */}
        <main className="flex-1 min-w-0 p-4 lg:p-6 overflow-x-hidden">
          <div className="max-w-[1440px] mx-auto">
            <Outlet />
          </div>
        </main>
      </div>

      {/* Quiet, Honest Workspace Status Footer */}
      <footer className="border-t border-slate-800/80 bg-[#041126] px-4 lg:px-6 py-2 text-[11px] text-slate-400 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 tabular-nums">
          <span className="font-mono text-slate-200">
            {activeRepo?.fullName || 'No repository selected'}
          </span>
          {activeRepo && (
            <>
              <span aria-hidden="true">·</span>
              <span>{activeRepo.isSample ? 'Sample Demo Data' : 'Live Indexed Repository'}</span>
              <span aria-hidden="true">·</span>
              <span>
                {activeRepo.fileCount} files / {activeRepo.symbolCount} symbols
              </span>
            </>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span>
            Neo4j:{' '}
            <strong className="font-normal text-slate-200">
              {health?.services.neo4j.status === 'connected'
                ? 'Connected'
                : 'Not Configured (Local Graph)'}
            </strong>
          </span>
          <span aria-hidden="true">·</span>
          <span>
            Sarvam:{' '}
            <strong className="font-normal text-slate-200">
              {health?.services.sarvam.status === 'connected'
                ? 'Connected'
                : 'Not Configured (AI Fallback)'}
            </strong>
          </span>
          <span aria-hidden="true">·</span>
          <button
            type="button"
            onClick={() => setShortcutsModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-[#071A35] hover:bg-[#0A2042] border border-slate-700/80 text-slate-300 hover:text-cyan-300 transition-colors cursor-pointer"
            title={`View all keyboard shortcuts (${modKey}/ or ?)`}
          >
            <Keyboard className="w-3 h-3 text-cyan-300" />
            <span>Shortcuts</span>
            <kbd className="text-[9px] font-mono text-cyan-300 bg-[#020817] px-1 rounded border border-slate-700">
              ?
            </kbd>
          </button>
          <span aria-hidden="true">·</span>
          <span className="text-slate-300">Team INNOVATION NINJAS · hackFront India 2026</span>
        </div>
      </footer>

      {/* Modals & HUD */}
      <IngestRepoModal />
      <GlobalSearchModal />
      <KeyboardShortcutsModal />
      <ShortcutHUDToast />
      <VoiceAIAssistantModal
        isOpen={voiceModalOpen}
        onClose={() => setVoiceModalOpen(false)}
      />
    </div>
  );
};
