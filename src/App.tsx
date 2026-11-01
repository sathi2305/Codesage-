import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import './index.css';
import { CodeSageProvider } from './context/CodeSageContext';
import { DashboardLayout } from './layouts/DashboardLayout';
import { HomePage } from './pages/HomePage';
import { AskCodeSagePage } from './pages/AskCodeSagePage';
import { RepositoryExplorerPage } from './pages/RepositoryExplorerPage';
import { KnowledgeGraphPage } from './pages/KnowledgeGraphPage';
import { DependenciesPage } from './pages/DependenciesPage';
import { BugDetectivePage } from './pages/BugDetectivePage';
import { CodeExplainerPage } from './pages/CodeExplainerPage';
import { ApiFlowPage } from './pages/ApiFlowPage';
import { DocumentationStudioPage } from './pages/DocumentationStudioPage';
import { InvestigationHistoryPage } from './pages/InvestigationHistoryPage';
import { CodeAnalysisPage } from './pages/CodeAnalysisPage';
import { SettingsPage } from './pages/SettingsPage';

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

class AppErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, message: error.message || 'Unexpected rendering error' };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#020817] text-slate-100 flex items-center justify-center p-6">
          <div className="max-w-md w-full rounded-xl border border-slate-800 bg-[#071A35] p-6 space-y-4">
            <h1 className="text-lg font-bold text-white">Workspace Recovery</h1>
            <p className="text-xs text-slate-300 leading-relaxed">{this.state.message}</p>
            <button
              type="button"
              onClick={() => window.location.assign('/')}
              className="px-4 py-2 rounded-lg bg-[#2563FF] text-xs font-medium text-white cursor-pointer"
            >
              Reload CodeSage AI
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export function App() {
  return (
    <AppErrorBoundary>
      <CodeSageProvider>
        <BrowserRouter>
          <Routes>
            <Route element={<DashboardLayout />}>
              <Route path="/" element={<HomePage />} />
              <Route path="/ask" element={<AskCodeSagePage />} />
              <Route path="/explorer" element={<RepositoryExplorerPage />} />
              <Route path="/graph" element={<KnowledgeGraphPage />} />
              <Route path="/dependencies" element={<DependenciesPage />} />
              <Route path="/bugs" element={<BugDetectivePage />} />
              <Route path="/explainer" element={<CodeExplainerPage />} />
              <Route path="/apiflow" element={<ApiFlowPage />} />
              <Route path="/docs" element={<DocumentationStudioPage />} />
              <Route path="/history" element={<InvestigationHistoryPage />} />
              <Route path="/analysis" element={<CodeAnalysisPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </CodeSageProvider>
    </AppErrorBoundary>
  );
}

export default App;

// Single Root Entry Point Mounting
const container = document.getElementById('root');
if (container) {
  createRoot(container).render(<App />);
}
