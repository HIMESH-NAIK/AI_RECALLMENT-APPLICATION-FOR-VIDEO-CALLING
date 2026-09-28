import React from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Dashboard from './pages/Dashboard'
import AIWorkspace from './pages/AIWorkspace'
import Meetings from './pages/Meetings'
import MeetingDetails from './pages/MeetingDetails'
import MeetingForm from './pages/MeetingForm'
import MeetingPrepare from './pages/MeetingPrepare'
import Memory from './pages/Memory'
import Status from './pages/Status'
import MeetingRoom from './pages/MeetingRoom'
import JoinMeeting from './pages/JoinMeeting'
import Settings from './pages/Settings'
import './index.css'
import { SettingsProvider } from './context/SettingsContext'

// CursorGlow is mounted from AppLayout using SettingsContext.

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/meetings" element={<Meetings />} />
        <Route path="/meetings/new" element={<MeetingForm />} />
        <Route path="/meetings/:id/edit" element={<MeetingForm />} />
        <Route path="/meetings/:id/prepare" element={<MeetingPrepare />} />
        <Route path="/meetings/:id" element={<MeetingDetails />} />
        <Route path="/meeting/:roomId" element={<MeetingRoom />} />
        <Route path="/join" element={<JoinMeeting />} />
        <Route path="/ai-prep" element={<MeetingPrepare />} />
        <Route path="/ai" element={<AIWorkspace />} />
        <Route path="/memory" element={<Memory />} />
        <Route path="/status" element={<Status />} />
        <Route path="/settings" element={<Settings />} />
      </Routes>
    </BrowserRouter>
  )
}

// Wrap App with SettingsProvider
createRoot(document.getElementById('root')!).render(
  <SettingsProvider>
    <App />
  </SettingsProvider>
)
