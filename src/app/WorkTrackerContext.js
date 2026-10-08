import { createContext, useContext } from 'react'
export const WorkTrackerContext = createContext(null)
export function useWorkTracker() {
  const context = useContext(WorkTrackerContext)
  if (!context) throw new Error('WorkTrackerProvider is required')
  return context
}
