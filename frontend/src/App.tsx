import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import AppShell from './components/AppShell';
import ProvisioningPage from './features/provisioning/ProvisioningPage';

export default function App() {
  return (
    <BrowserRouter>
      <AppShell>
        <Routes>
          <Route path="/" element={<Navigate to="/app/provision" replace />} />
          <Route path="/app/provision" element={<ProvisioningPage />} />
        </Routes>
      </AppShell>
    </BrowserRouter>
  );
}
