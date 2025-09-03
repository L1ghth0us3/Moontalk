import MoontalkApp from "./MoontalkApp";
import WhatIsThis from "./pages/WhatIsThis";
// Minimal shell and route switch by pathname.
export default function App(){
  const path = typeof window !== 'undefined' ? window.location.pathname : '/';
  if (path === '/what-is-this') return <WhatIsThis/>;
  // Translator 2.0 now lives inside the main page (tabbed)
  return <MoontalkApp/>;
}
