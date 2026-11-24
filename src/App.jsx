import { lazy, Suspense, useEffect } from 'react'
import { Routes, Route } from 'react-router-dom'
import { UserProvider } from './context/UserContext'
import { ToastProvider } from './components/Toast'
import OrbiCompanion from './components/orbi/OrbiCompanion'

const DashLayout = lazy(() => import('./components/DashLayout'))

const Algebra = lazy(() => import('./pages/Algebra'))
const Geometry = lazy(() => import('./pages/Geometry'))
const AdvancedMath = lazy(() => import('./pages/AdvancedMath'))
const DataAnalysis = lazy(() => import('./pages/DataAnalysis'))
const ProblemSolving = lazy(() => import('./pages/ProblemSolving'))
const Study = lazy(() => import('./pages/Study'))
const StudySubject = lazy(() => import('./pages/StudySubject'))
const StudyWatch = lazy(() => import('./pages/StudyWatch'))
const AdminVideos = lazy(() => import('./pages/AdminVideos'))
const AdminSubjects = lazy(() => import('./pages/AdminSubjects'))
const AdminQuestions = lazy(() => import('./pages/AdminQuestions'))

const TestPage = lazy(() => import('./pages/TestPage'))
const TestReview = lazy(() => import('./pages/TestReview'))
const SatTestAdmin = lazy(() => import('./pages/SatTestAdmin'))
const SatTestList = lazy(() => import('./pages/SatTestList'))
const SatTestPage = lazy(() => import('./pages/SatTestPage'))

// Routes now served by the premium design pages (static, see public/dc and vercel.json).
function HardRedirect({ to }) {
  useEffect(() => { window.location.replace((to || window.location.pathname) + window.location.search + window.location.hash) }, [to])
  return null
}

function SuspenseWrap({ children }) {
  return <Suspense fallback={<div className="page-loading" />}>{children}</Suspense>
}

export default function App() {
  return (
    <UserProvider>
      <ToastProvider>
        <Routes>
          <Route path="/" element={<HardRedirect to="/dc/Main.dc.html" />} />
          <Route path="/auth" element={<HardRedirect to="/dc/Auth.dc.html" />} />
          <Route element={<SuspenseWrap><DashLayout /></SuspenseWrap>}>
            <Route path="/dashboard" element={<HardRedirect to="/dc/Dashboard.dc.html" />} />
            <Route path="/algebra" element={<SuspenseWrap><Algebra /></SuspenseWrap>} />
            <Route path="/geometry" element={<SuspenseWrap><Geometry /></SuspenseWrap>} />
            <Route path="/advanced-math" element={<SuspenseWrap><AdvancedMath /></SuspenseWrap>} />
            <Route path="/data-analysis" element={<SuspenseWrap><DataAnalysis /></SuspenseWrap>} />
            <Route path="/problem-solving" element={<SuspenseWrap><ProblemSolving /></SuspenseWrap>} />
            <Route path="/study" element={<SuspenseWrap><Study /></SuspenseWrap>} />
            <Route path="/study/subject/:subjectId" element={<SuspenseWrap><StudySubject /></SuspenseWrap>} />
            <Route path="/study/subject/:subjectId/watch/:videoId" element={<SuspenseWrap><StudyWatch /></SuspenseWrap>} />
            <Route path="/admin/videos" element={<SuspenseWrap><AdminVideos /></SuspenseWrap>} />
            <Route path="/admin/subjects" element={<SuspenseWrap><AdminSubjects /></SuspenseWrap>} />
            <Route path="/practice/sat-tests" element={<SuspenseWrap><SatTestList /></SuspenseWrap>} />
            <Route path="/test-history" element={<HardRedirect to="/dc/History.dc.html" />} />
            <Route path="/study-plan" element={<HardRedirect to="/dc/Plan.dc.html" />} />
            <Route path="/profile" element={<HardRedirect to="/dc/Profile.dc.html" />} />
            <Route path="/settings" element={<HardRedirect to="/dc/Settings.dc.html" />} />
            <Route path="/support" element={<HardRedirect to="/dc/Help.dc.html" />} />
                        <Route path="/admin/questions" element={<SuspenseWrap><AdminQuestions /></SuspenseWrap>} />
            <Route path="/test-review/:testId" element={<SuspenseWrap><TestReview /></SuspenseWrap>} />
            <Route path="/admin/sat-tests" element={<SuspenseWrap><SatTestAdmin /></SuspenseWrap>} />
          </Route>
          <Route path="/sat-test/:testId" element={<SuspenseWrap><SatTestPage /></SuspenseWrap>} />
          <Route path="/test/:subjectSlug/:difficulty" element={<SuspenseWrap><TestPage /></SuspenseWrap>} />
          <Route path="*" element={<HardRedirect to="/dc/NotFound.dc.html" />} />
        </Routes>
        <OrbiCompanion />
      </ToastProvider>
    </UserProvider>
  )
}
