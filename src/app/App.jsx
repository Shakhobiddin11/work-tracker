import { useSyncExternalStore } from 'react'
import { getCurrentSection, navigateToSection, subscribeToNavigation } from './navigation.js'
import WorkTrackerProvider from './WorkTrackerProvider.jsx'
import AppShell from '../components/layout/AppShell.jsx'
import Dashboard from '../features/dashboard/Dashboard.jsx'
import Timer from '../features/timer/Timer.jsx'
import Projects from '../features/projects/Projects.jsx'
import Income from '../features/income/Income.jsx'
import Goals from '../features/goals/Goals.jsx'
const sections = [
  { id: 'dashboard', label: 'Dashboard', component: Dashboard },
  { id: 'timer', label: 'Timer', component: Timer },
  { id: 'projects', label: 'Projects', component: Projects },
  { id: 'income', label: 'Income', component: Income },
  { id: 'goals', label: 'Goals', component: Goals },
]
export default function App() {
  const active = useSyncExternalStore(subscribeToNavigation, getCurrentSection)
  const Section = sections.find(section => section.id === active).component
  return <WorkTrackerProvider><AppShell sections={sections} active={active} onNavigate={navigateToSection}><Section /></AppShell></WorkTrackerProvider>
}
