import React from 'react'
import AppLayout from '../components/layout/AppLayout'
import { useSettings } from '../context/SettingsContext'

export default function Settings() {
  const { effectsEnabled, setEffectsEnabled } = useSettings()

  return (
    <AppLayout>
      <div className="p-6 bg-white rounded shadow card-glass">
        <h2 className="text-xl font-semibold">Settings</h2>
        <div className="mt-4">
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={effectsEnabled}
              onChange={(e) => setEffectsEnabled(e.target.checked)}
            />
            <span className="text-sm">Enable visual effects (subtle glow & shine)</span>
          </label>
        </div>
      </div>
    </AppLayout>
  )
}
