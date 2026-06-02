import { lazy, Suspense } from 'react'
import { Routes, Route, Outlet } from 'react-router-dom'
import DashLayout from './components/DashLayout'

const Home = lazy(() => import('./pages/Home'))
const Auth = lazy(() => import('./pages/Auth'))
const Dashboard = lazy(() => import('./pages/Dashboard'))
const SatMath = lazy(() => import('./pages/SatMath'))
const SatRW = lazy(() => import('./pages/SatRW'))
const ApBio = lazy(() => import('./pages/ApBio'))
const ApCalc = lazy(() => import('./pages/ApCalc'))
const PracticeTests = lazy(() => import('./pages/PracticeTests'))
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
    <Routes>
      <Route element={<SuspenseWrap><HomeLayout /></SuspenseWrap>}>
        <Route path="/" element={null} />
        <Route path="/auth" element={<SuspenseWrap><Auth /></SuspenseWrap>} />
      </Route>
      <Route element={<DashLayout />}>
        <Route path="/dashboard" element={<SuspenseWrap><Dashboard /></SuspenseWrap>} />
        <Route path="/sat-math" element={<SuspenseWrap><SatMath /></SuspenseWrap>} />
        <Route path="/sat-rw" element={<SuspenseWrap><SatRW /></SuspenseWrap>} />
        <Route path="/ap-bio" element={<SuspenseWrap><ApBio /></SuspenseWrap>} />
        <Route path="/ap-calc" element={<SuspenseWrap><ApCalc /></SuspenseWrap>} />
        <Route path="/practice-tests" element={<SuspenseWrap><PracticeTests /></SuspenseWrap>} />
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
  )
}
