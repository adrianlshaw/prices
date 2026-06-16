import { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import ScannerScreen from './screens/ScannerScreen';
import ResultScreen from './screens/ResultScreen';
import AddPriceScreen from './screens/AddPriceScreen';
import SettingsScreen from './screens/SettingsScreen';
import { syncOnStartup } from './sync';

export default function App() {
  useEffect(() => {
    void syncOnStartup();
  }, []);

  return (
    <Routes>
      <Route path="/" element={<ScannerScreen />} />
      <Route path="/result/:barcode" element={<ResultScreen />} />
      <Route path="/add/:barcode" element={<AddPriceScreen />} />
      <Route path="/settings" element={<SettingsScreen />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
