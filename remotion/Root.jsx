import { Composition } from 'remotion';
import { Intro } from './Intro.jsx';

export const RemotionRoot = () => (
  <Composition
    id="Intro"
    component={Intro}
    durationInFrames={150}
    fps={30}
    width={1080}
    height={1920}
  />
);
