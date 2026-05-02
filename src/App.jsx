import { Routes, Route } from 'react-router-dom'
import Landing from './pages/Landing'
import GameApp from './pages/GameApp'
import './styles/design-system.css'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/game" element={<GameApp />} />
    </Routes>
  )
}
