import { CombinedProvider } from "./context/combinedContext";
import 'tailwindcss/tailwind.css'
import Routes from "./routes";
import "./index.css";

function App() {
  return (
    <CombinedProvider>
        <Routes />
    </CombinedProvider>
  );
}

export default App;
