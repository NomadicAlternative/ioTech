import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { LoginPage } from '@/features/auth/LoginPage'
import { RegisterPage } from '@/features/auth/RegisterPage'
import { LandingPage } from '@/features/landing/LandingPage'
import { ProtectedRoute } from '@/features/auth/ProtectedRoute'
import { DashboardListPage } from '@/features/dashboard/DashboardListPage'
import { DashboardViewPage } from '@/features/dashboard/DashboardViewPage'
import { DashboardEditorPage } from '@/features/dashboard/DashboardEditorPage'
import { DeviceListPage } from '@/features/devices/DeviceListPage'
import { DeviceDetailPage } from '@/features/devices/DeviceDetailPage'
import { TemplateListPage } from '@/features/templates/TemplateListPage'
import { ClientListPage } from '@/features/clients/ClientListPage'
import { RulesPage } from '@/features/rules/RulesPage'
import { FirmwareListPage } from '@/features/firmware/FirmwareListPage'
import { ProvisioningPage } from '@/features/provisioning/ProvisioningPage'
import { CatalogPage } from '@/features/catalog/CatalogPage'
import { TenantsPage } from '@/features/admin/TenantsPage'
import { DashboardPage } from '@/features/admin/DashboardPage'
import { InstallerDetailPage } from '@/features/admin/InstallerDetailPage'
import { AIChat } from '@/features/ai/AIChat'
import { SettingsPage } from '@/features/settings/SettingsPage'
import { SocketProvider } from '@/providers/SocketProvider'
import { ErrorBoundary } from '@/components/ErrorBoundary'

function PlaceholderPage({ name }: { name: string }) {
  return (
    <div className="flex items-center justify-center h-full">
      <h1 className="text-2xl font-semibold text-muted-foreground">{name}</h1>
    </div>
  )
}

function NotFoundPage() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <h1 className="text-4xl font-bold">404</h1>
        <p className="text-muted-foreground mt-2">Page not found</p>
        <a href="/app/dashboards" className="text-primary underline mt-4 block">
          Go to dashboards
        </a>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/app" element={<SocketProvider><ProtectedRoute /></SocketProvider>}>
          <Route path="dashboards" element={<DashboardListPage />} />
          <Route path="dashboards/:id" element={<DashboardViewPage />} />
          <Route
            path="dashboards/:id/edit"
            element={<DashboardEditorPage />}
          />
          <Route path="devices" element={<DeviceListPage />} />
          <Route path="devices/:id" element={<ErrorBoundary><DeviceDetailPage /></ErrorBoundary>} />
          <Route path="templates" element={<TemplateListPage />} />
          <Route path="clients" element={<ClientListPage />} />
          <Route path="rules" element={<RulesPage />} />
          <Route path="firmware" element={<FirmwareListPage />} />
          <Route path="provision" element={<ErrorBoundary><ProvisioningPage /></ErrorBoundary>} />
          <Route path="catalog" element={<ErrorBoundary><CatalogPage /></ErrorBoundary>} />
          <Route path="tenants" element={<ErrorBoundary><TenantsPage /></ErrorBoundary>} />
          <Route path="admin/dashboard" element={<ErrorBoundary><DashboardPage /></ErrorBoundary>} />
          <Route path="admin/tenants/:id" element={<ErrorBoundary><InstallerDetailPage /></ErrorBoundary>} />
          <Route path="ai" element={<ErrorBoundary><AIChat /></ErrorBoundary>} />
          <Route path="settings" element={<ErrorBoundary><SettingsPage /></ErrorBoundary>} />
        </Route>
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  )
}
