import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { TransitionSeries, linearTiming } from '@remotion/transitions';
import { fade } from '@remotion/transitions/fade';
import { slide } from '@remotion/transitions/slide';
import { Circle, Star } from '@remotion/shapes';
import { loadFont } from '@remotion/google-fonts/Montserrat';

const { fontFamily } = loadFont('normal', { weights: ['800'], subsets: ['latin'] });

const Title = ({ text, bg }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const scale = spring({ frame, fps, config: { damping: 12 } });
  const rotate = interpolate(frame, [0, 60], [0, 180]);

  return (
    <AbsoluteFill style={{ backgroundColor: bg, justifyContent: 'center', alignItems: 'center' }}>
      <div style={{ position: 'absolute', transform: `rotate(${rotate}deg) scale(${scale})`, opacity: 0.25 }}>
        <Star points={5} innerRadius={200} outerRadius={420} fill="#fff" />
      </div>
      <h1 style={{ color: 'white', fontSize: 120, fontFamily, textAlign: 'center', transform: `scale(${scale})` }}>{text}</h1>
    </AbsoluteFill>
  );
};

const Outro = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const grow = spring({ frame, fps, config: { damping: 200 } });

  return (
    <AbsoluteFill style={{ backgroundColor: '#111', justifyContent: 'center', alignItems: 'center' }}>
      <div style={{ position: 'absolute', transform: `scale(${grow * 3})` }}>
        <Circle radius={200} fill="#c9a24d" />
      </div>
      <h1 style={{ color: '#111', fontSize: 100, fontFamily }}>Distinto SCZ</h1>
    </AbsoluteFill>
  );
};

export const Intro = () => (
  <TransitionSeries>
    <TransitionSeries.Sequence durationInFrames={60}>
      <Title text="Perfumes" bg="#1d1d1f" />
    </TransitionSeries.Sequence>
    <TransitionSeries.Transition presentation={slide({ direction: 'from-right' })} timing={linearTiming({ durationInFrames: 15 })} />
    <TransitionSeries.Sequence durationInFrames={60}>
      <Title text="Originales" bg="#6b2d5c" />
    </TransitionSeries.Sequence>
    <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: 15 })} />
    <TransitionSeries.Sequence durationInFrames={60}>
      <Outro />
    </TransitionSeries.Sequence>
  </TransitionSeries>
);
