import { CombinedProvider } from "./context/combinedContext";
import Routes from "./routes";

import 'tailwindcss/tailwind.css'
import "./index.css";


function App() {
  return (
      <CombinedProvider>
          <Routes />
      </CombinedProvider>
  );
}

export default App;
