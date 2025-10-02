import './main.css'
import { BrowserRouter as Router, Routes, Route, Link } from "react-router-dom"
import DetectingPage from './pages/DetectingPage'
import MultiDetectPage from './pages/MultiDetectPage'


function App() {
  return (
    <Router>
      <div className="min-h-screen text-white flex flex-col font-[MontserratAlternates]">
        <header className="bg-at-violet px-14 text-[28px] h-[50px] font-semibold flex items-center flex gap-10">
          <a href="/">Detecting</a>
          <Link to="/multi">Multi-Detect</Link>
        </header>
        <div className="px-14 py-6 flex-1 bg-at-brown flex justify-between items-start gap-12">
          <Routes>
            <Route path="/" element={<DetectingPage />} />
            <Route path="/multi" element={<MultiDetectPage />} />
          </Routes>
        </div>
      </div>
    </Router>
  )
}

export default App