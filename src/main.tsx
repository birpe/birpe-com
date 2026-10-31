import { createRoot } from 'react-dom/client';
import BirpeLanding from './components/BirpeLanding';
import './styles/global.css';
import { installMotionTokens } from './lib/motion';
import { installViewportZoom } from './lib/viewportZoom';

installMotionTokens();
const removeViewportZoom = installViewportZoom();
if (import.meta.hot) import.meta.hot.dispose(removeViewportZoom);

createRoot(document.getElementById('root')!).render(<BirpeLanding />);
