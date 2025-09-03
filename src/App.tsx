import MoontalkApp from "./MoontalkApp";
import WhatIsThis from "./pages/WhatIsThis";
import Translator2Page from "./pages/Translator2Page";
// Minimal shell and route switch by pathname.
export default function App(){
  const path = typeof window !== 'undefined' ? window.location.pathname : '/';
  if (path === '/what-is-this') return <WhatIsThis/>;
  if (path === '/translator2' || path === '/translator-2') return <Translator2Page/>;
  return <MoontalkApp/>;
}
