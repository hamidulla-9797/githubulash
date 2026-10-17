import React from 'react';
import {AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig, Easing} from 'remotion';
import type {Props} from './Root';
import {shriftYukla} from './shrift';

// Katta raqam 0 dan sanab chiqadi, ostida izoh: "360 mln" → 0…360 + " mln"
export const Raqam: React.FC<Props> = ({matn, raqam = '100', rang = '#FFD400', W, H, xz}) => {
	shriftYukla();
	const f = useCurrentFrame();
	const {fps, durationInFrames} = useVideoConfig();
	const m = raqam.match(/^([^\d]*)([\d\s.,]+)(.*)$/);
	const old = m ? m[1] : '', son = m ? parseFloat(m[2].replace(/[\s,]/g, '')) : 0, qo = m ? m[3] : raqam;
	const k = interpolate(f, [0, fps * 1.0], [0, 1], {extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic)});
	const kasr = m && m[2].includes('.') ? 1 : 0;
	const hozir = (son * k).toLocaleString('ru-RU', {minimumFractionDigits: kasr, maximumFractionDigits: kasr});
	const kir = spring({frame: f, fps, config: {damping: 13}});
	const chiq = interpolate(f, [durationInFrames - 8, durationInFrames], [1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
	const vert = H > W;
	const size = W * (vert ? 0.2 : 0.11);
	return (
		<AbsoluteFill style={{alignItems: 'center', justifyContent: 'flex-start', paddingTop: Math.max(H * (vert ? 0.12 : 0.1), (xz?.top ?? 0) + H * 0.02), opacity: chiq}}>
			<div style={{
				transform: `scale(${0.7 + 0.3 * kir})`, textAlign: 'center',
				background: 'rgba(0,0,0,.55)', borderRadius: size * 0.2, padding: `${size * 0.12}px ${size * 0.3}px`,
			}}>
				<div style={{fontFamily: 'MontB', fontSize: size, color: rang, lineHeight: 1, whiteSpace: 'nowrap'}}>
					{old}{m ? hozir : ''}<span style={{fontSize: size * 0.55}}>{qo}</span>
				</div>
				<div style={{fontFamily: 'MontX', fontSize: size * 0.26, color: '#fff', textTransform: 'uppercase', marginTop: size * 0.08}}>
					{matn}
				</div>
			</div>
		</AbsoluteFill>
	);
};
