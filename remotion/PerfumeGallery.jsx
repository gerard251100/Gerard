import { AbsoluteFill, Easing, Img, interpolate, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { CameraMotionBlur } from '@remotion/motion-blur';
import { BOTTLE_ILLUSTRATIONS } from './PerfumeBottles.jsx';

// Product photos go in remotion/public/perfumes/. Use transparent PNGs cropped tight
// to the bottle so they all scale to the same height. Missing photos fall back to an illustration.
export const PERFUMES = [
  { id: 'hawas-chrome', photo: 'perfumes/rasasi-hawas-chrome.png' },
  { id: 'dunescape', photo: 'perfumes/armaf-dunescape.png' },
  { id: 'mandarinsky', photo: 'perfumes/armaf-odyssey-mandarinsky.png' },
];

export const CHROMA_GREEN = '#00FF00';
const DRIFT_SECONDS = 2;
const SWIPE_SECONDS = 0.3;
export const CYCLE_SECONDS = DRIFT_SECONDS + SWIPE_SECONDS;

// Detect which photos exist before rendering, so the video works with or without them.
export const calculateGalleryMetadata = async ({ props }) => {
  const perfumes = await Promise.all(
    props.perfumes.map(async (perfume) => {
      try {
        const res = await fetch(staticFile(perfume.photo), { method: 'HEAD' });
        const isImage = res.ok && (res.headers.get('content-type') ?? '').startsWith('image/');
        return { ...perfume, hasPhoto: isImage };
      } catch {
        return { ...perfume, hasPhoto: false };
      }
    }),
  );
  return { props: { ...props, perfumes } };
};

const Card = ({ perfume, width, height }) => {
  const Illustration = BOTTLE_ILLUSTRATIONS[perfume.id];
  const bottleHeight = height * 0.78;

  return (
    <div
      style={{
        width,
        height,
        borderRadius: width * 0.08,
        backgroundColor: '#FFFFFF',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      {perfume.hasPhoto ? (
        <Img src={staticFile(perfume.photo)} style={{ height: bottleHeight, maxWidth: width * 0.86, objectFit: 'contain' }} />
      ) : (
        <Illustration height={bottleHeight} />
      )}
    </div>
  );
};

// Gallery position in "slots": +1 means the strip moved one card to the right.
// Constant slow drift, plus a swipe that adds the rest of the slot. The swipe easing
// starts and ends with zero extra speed, so it accelerates hard and settles back into the drift.
const useGalleryPosition = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const cycle = Math.floor(t / CYCLE_SECONDS);
  const local = t - cycle * CYCLE_SECONDS;
  const driftPerSecond = 0.02;
  const swipe = interpolate(local, [DRIFT_SECONDS, CYCLE_SECONDS], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.bezier(0.7, 0, 0.15, 1),
  });
  const position = cycle + driftPerSecond * local + (1 - driftPerSecond * CYCLE_SECONDS) * swipe;
  // Keep the centered card centered on average during its drift.
  return position - driftPerSecond * (DRIFT_SECONDS / 2);
};

const Strip = ({ perfumes }) => {
  const { width, height } = useVideoConfig();
  const position = useGalleryPosition();
  const cardWidth = width * 0.72;
  const cardHeight = cardWidth * 1.42;
  const spacing = width * 1.05;
  const current = Math.floor(position);

  return (
    <AbsoluteFill>
      {[current - 1, current, current + 1, current + 2].map((slot) => {
        const perfume = perfumes[((slot % perfumes.length) + perfumes.length) % perfumes.length];
        const x = width / 2 + (position - slot) * spacing - cardWidth / 2;
        return (
          <div key={slot} style={{ position: 'absolute', left: x, top: (height - cardHeight) / 2 }}>
            <Card perfume={perfume} width={cardWidth} height={cardHeight} />
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

export const PerfumeGallery = ({ perfumes }) => {
  return (
    <AbsoluteFill style={{ backgroundColor: CHROMA_GREEN }}>
      <CameraMotionBlur samples={32} shutterAngle={270}>
        <Strip perfumes={perfumes} />
      </CameraMotionBlur>
    </AbsoluteFill>
  );
};
