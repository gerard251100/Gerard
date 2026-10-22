import { Composition } from 'remotion';
import { Intro } from './Intro.jsx';
import { CYCLE_SECONDS, PERFUMES, PerfumeGallery, calculateGalleryMetadata } from './PerfumeGallery.jsx';

const GALLERY_FPS = 30;

export const RemotionRoot = () => (
  <>
    <Composition
      id="Intro"
      component={Intro}
      durationInFrames={150}
      fps={30}
      width={1080}
      height={1920}
    />
    {/* One full loop through the three perfumes: the last frame leads straight back into the first. */}
    <Composition
      id="PerfumeGallery"
      component={PerfumeGallery}
      durationInFrames={Math.round(PERFUMES.length * CYCLE_SECONDS * GALLERY_FPS)}
      fps={GALLERY_FPS}
      width={2160}
      height={3840}
      defaultProps={{ perfumes: PERFUMES }}
      calculateMetadata={calculateGalleryMetadata}
    />
  </>
);
