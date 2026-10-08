import { useState, useSyncExternalStore } from 'react'
import { createStateStore } from './stateStore.js'
import { WorkTrackerContext } from './WorkTrackerContext.js'
export default function WorkTrackerProvider({ children }) {
  const [store] = useState(createStateStore)
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot)
  return <WorkTrackerContext.Provider value={{ ...snapshot, setData: store.setData, replaceData: store.replaceData }}>{children}</WorkTrackerContext.Provider>
}
