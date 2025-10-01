import './main.css'
import DetectingPage from './pages/DetectingPage'


function App() {
  return (
    <div className="min-h-screen text-white flex flex-col font-[MontserratAlternates]">
      <header className="bg-at-violet px-14 text-[28px] h-[50px] font-semibold flex items-center ">
        <a href="/">Detecting</a>
      </header>
      <div className="px-14 py-6 flex-1 bg-at-brown flex justify-between items-start gap-12">
        <DetectingPage/>
      </div>
      {/* <footer className="px-14 bg-at-violet h-[50px] text-at-gray font-normal flex items-center justify-end">
        Это база
      </footer> */}
    </div>
  )
}

export default App