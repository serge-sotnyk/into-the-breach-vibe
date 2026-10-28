import '@fontsource/chakra-petch/400.css';
import '@fontsource/chakra-petch/600.css';
import '@fontsource/chakra-petch/700.css';
import './style.css';
import { App } from './ui/app';

const app = new App();
app.start();

// Expose for debugging in the console (?debug enables extra keys: P autoplay, F9 instant win).
(window as unknown as { irongrid: App }).irongrid = app;
