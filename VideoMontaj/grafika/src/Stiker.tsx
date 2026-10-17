import React from 'react';
import {AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import type {Props} from './Root';

// iPhone (Apple Color Emoji) stikeri: sakrab chiqadi, tebranadi, kichrayib yo'qoladi
export const Stiker: React.FC<Props> = ({emoji = '🔥', W}) => {
	const f = useCurrentFrame();
	const {fps, durationInFrames} = useVideoConfig();
	const kir = spring({frame: f, fps, config: {damping: 9, stiffness: 180, mass: 0.7}});
	const chiq = interpolate(f, [durationInFrames - 7, durationInFrames], [1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
	const teb = Math.sin((f / fps) * Math.PI * 2 * 1.2) * 7 * kir;
	return (
		<AbsoluteFill style={{alignItems: 'center', justifyContent: 'center'}}>
			<div style={{
				fontSize: W * 0.72, lineHeight: 1,
				fontFamily: '"Apple Color Emoji"',
				transform: `scale(${kir * chiq}) rotate(${-14 + 14 * kir + teb}deg)`,
				filter: `drop-shadow(0 ${W * 0.03}px ${W * 0.05}px rgba(0,0,0,.45))`,
			}}>
				{emoji}
			</div>
		</AbsoluteFill>
	);
};
