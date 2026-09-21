import { lazy, Suspense } from 'react'
import { Routes, Route, Outlet } from 'react-router-dom'
import { UserProvider } from './context/UserContext'
import { ToastProvider } from './components/Toast'

const DashLayout = lazy(() => import('./components/DashLayout'))

const Home = lazy(() => import('./pages/Home'))
const Auth = lazy(() => import('./pages/Auth'))
const Dashboard = lazy(() => import('./pages/Dashboard'))
const Algebra = lazy(() => import('./pages/Algebra'))
const Geometry = lazy(() => import('./pages/Geometry'))
const AdvancedMath = lazy(() => import('./pages/AdvancedMath'))
const DataAnalysis = lazy(() => import('./pages/DataAnalysis'))
const ProblemSolving = lazy(() => import('./pages/ProblemSolving'))
const Study = lazy(() => import('./pages/Study'))
const StudySubject = lazy(() => import('./pages/StudySubject'))
const StudyWatch = lazy(() => import('./pages/StudyWatch'))
const AdminVideos = lazy(() => import('./pages/AdminVideos'))
const TestHistory = lazy(() => import('./pages/TestHistory'))
const StudyPlan = lazy(() => import('./pages/StudyPlan'))
const Profile = lazy(() => import('./pages/Profile'))
const Settings = lazy(() => import('./pages/Settings'))
const Support = lazy(() => import('./pages/Support'))
const AdminQuestions = lazy(() => import('./pages/AdminQuestions'))
const TopicsPage = lazy(() => import('./pages/TopicsPage'))
const TestPage = lazy(() => import('./pages/TestPage'))
const TestReview = lazy(() => import('./pages/TestReview'))
const SatTestAdmin = lazy(() => import('./pages/SatTestAdmin'))
const SatTestList = lazy(() => import('./pages/SatTestList'))
const SatTestPage = lazy(() => import('./pages/SatTestPage'))
const NotFound = lazy(() => import('./pages/NotFound'))

function HomeLayout() {
  return (
    <>
      <Suspense fallback={null}>
        <Home />
      </Suspense>
      <Outlet />
    </>
  )
}

function SuspenseWrap({ children }) {
  return <Suspense fallback={<div className="page-loading" />}>{children}</Suspense>
}

export default function App() {
  return (
    <UserProvider>
      <ToastProvider>
        <Routes>
          <Route element={<SuspenseWrap><HomeLayout /></SuspenseWrap>}>
            <Route path="/" element={null} />
            <Route path="/auth" element={<SuspenseWrap><Auth /></SuspenseWrap>} />
          </Route>
          <Route element={<SuspenseWrap><DashLayout /></SuspenseWrap>}>
            <Route path="/dashboard" element={<SuspenseWrap><Dashboard /></SuspenseWrap>} />
            <Route path="/algebra" element={<SuspenseWrap><Algebra /></SuspenseWrap>} />
            <Route path="/geometry" element={<SuspenseWrap><Geometry /></SuspenseWrap>} />
            <Route path="/advanced-math" element={<SuspenseWrap><AdvancedMath /></SuspenseWrap>} />
            <Route path="/data-analysis" element={<SuspenseWrap><DataAnalysis /></SuspenseWrap>} />
            <Route path="/problem-solving" element={<SuspenseWrap><ProblemSolving /></SuspenseWrap>} />
            <Route path="/study" element={<SuspenseWrap><Study /></SuspenseWrap>} />
            <Route path="/study/subject/:subjectId" element={<SuspenseWrap><StudySubject /></SuspenseWrap>} />
            <Route path="/study/subject/:subjectId/watch/:videoId" element={<SuspenseWrap><StudyWatch /></SuspenseWrap>} />
            <Route path="/admin/videos" element={<SuspenseWrap><AdminVideos /></SuspenseWrap>} />
            <Route path="/practice/sat-tests" element={<SuspenseWrap><SatTestList /></SuspenseWrap>} />
            <Route path="/test-history" element={<SuspenseWrap><TestHistory /></SuspenseWrap>} />
            <Route path="/study-plan" element={<SuspenseWrap><StudyPlan /></SuspenseWrap>} />
            <Route path="/profile" element={<SuspenseWrap><Profile /></SuspenseWrap>} />
            <Route path="/settings" element={<SuspenseWrap><Settings /></SuspenseWrap>} />
            <Route path="/support" element={<SuspenseWrap><Support /></SuspenseWrap>} />
            <Route path="/topics/:moduleId" element={<SuspenseWrap><TopicsPage /></SuspenseWrap>} />
            <Route path="/admin/questions" element={<SuspenseWrap><AdminQuestions /></SuspenseWrap>} />
            <Route path="/test-review/:testId" element={<SuspenseWrap><TestReview /></SuspenseWrap>} />
            <Route path="/admin/sat-tests" element={<SuspenseWrap><SatTestAdmin /></SuspenseWrap>} />
          </Route>
          <Route path="/sat-test/:testId" element={<SuspenseWrap><SatTestPage /></SuspenseWrap>} />
          <Route path="/test/:topicId" element={<SuspenseWrap><TestPage /></SuspenseWrap>} />
          <Route path="*" element={<SuspenseWrap><NotFound /></SuspenseWrap>} />
        </Routes>
      </ToastProvider>
    </UserProvider>
  )
}
