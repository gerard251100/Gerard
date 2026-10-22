import { Config } from '@remotion/cli/config';

// Remotion lives in remotion/ so it does not mix with the web app's public/ folder.
Config.setEntryPoint('./remotion/index.jsx');
Config.setPublicDir('./remotion/public');
