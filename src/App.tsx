import { BrowserRouter, Navigate, Route, Routes } from "react-router"

import { AppLayout } from "@/components/layout/app-layout"
import { ConnectPage } from "@/pages/connect-page"
import { DashboardPage } from "@/pages/dashboard-page"
import { SettingsPage } from "@/pages/settings-page"

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route index element={<Navigate replace to="/connect" />} />
          <Route path="connect" element={<ConnectPage />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate replace to="/connect" />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
