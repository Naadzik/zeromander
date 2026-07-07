import { Routes, Route, Navigate } from 'react-router-dom'
import Landing from './pages/Landing'
import GameApp from './pages/GameApp'
import Methodology from './pages/Methodology'
import './styles/design-system.css'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/game" element={<GameApp />} />
      <Route path="/methodology" element={<Methodology />} />
      {/* Old shared links may still point here */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
