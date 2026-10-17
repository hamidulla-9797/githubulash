import React from 'react';
import {AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import type {Props} from './Root';
import {shriftYukla} from './shrift';

// Ekranning yuqori qismida chiqib-yo'qoladigan yozuv kartochkasi
export const Sarlavha: React.FC<Props> = ({matn, rang = '#FFD400', matnRang = '#111', W, H, xz}) => {
	shriftYukla();
	const f = useCurrentFrame();
	const {fps, durationInFrames} = useVideoConfig();
	const kir = spring({frame: f, fps, config: {damping: 14, stiffness: 160}});
	const chiq = interpolate(f, [durationInFrames - 8, durationInFrames], [1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
	const vert = H > W;
	const size = W * (vert ? 0.068 : 0.042);
	return (
		<AbsoluteFill style={{alignItems: 'center', justifyContent: 'flex-start', paddingTop: Math.max(H * (vert ? 0.14 : 0.08), (xz?.top ?? 0) + H * 0.02)}}>
			<div style={{
				transform: `scale(${0.6 + 0.4 * kir}) translateY(${(1 - kir) * -40}px)`,
				opacity: Math.min(kir * 1.5, 1) * chiq,
				background: rang, color: matnRang, fontFamily: 'MontB', fontSize: size, lineHeight: 1.15,
				padding: `${size * 0.45}px ${size * 0.7}px`, borderRadius: size * 0.35, maxWidth: W - 2 * Math.max(W * 0.07, xz?.left ?? 0, xz?.right ?? 0),
				textAlign: 'center', textTransform: 'uppercase', boxShadow: `0 ${size * 0.2}px ${size * 0.6}px rgba(0,0,0,.35)`,
			}}>
				{matn}
			</div>
		</AbsoluteFill>
	);
};
