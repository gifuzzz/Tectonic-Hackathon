import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from './components/AppShell'
import { CasesPage } from './pages/CasesPage'
import { CaseWorkspacePage } from './pages/CaseWorkspacePage'
import { KnowledgePage } from './pages/KnowledgePage'
import { ConflictsPage } from './pages/ConflictsPage'
import { ExpertsPage } from './pages/ExpertsPage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<CasesPage />} />
          <Route path="cases/:caseId" element={<CaseWorkspacePage />} />
          <Route path="knowledge" element={<KnowledgePage />} />
          <Route path="conflicts" element={<ConflictsPage />} />
          <Route path="experts" element={<ExpertsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

