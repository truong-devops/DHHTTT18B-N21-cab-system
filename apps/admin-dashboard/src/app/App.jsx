import { BrowserRouter } from 'react-router-dom';
import { AppProviders } from './providers.jsx';
import { AppRoutes } from '../routes/AppRoutes.jsx';

function App() {
  return (
    <BrowserRouter>
      <AppProviders>
        <AppRoutes />
      </AppProviders>
    </BrowserRouter>
  );
}

export default App;
