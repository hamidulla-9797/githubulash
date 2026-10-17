import React from 'react';
import {AbsoluteFill, Audio, Img, interpolate, Sequence, spring, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {shriftYukla} from './shrift';

// Ssenariydan rolik (kamerasiz): har kadr = sarlavha yorlig'i + ovozda aytiladigan gap,
// so'zlar birma-bir chiqadi. *yulduzcha* ichidagi so'z urg'u rangida. Hammasi xavfsiz zonada.
export type Kadr = {sarlavha: string; matn: string; boshi: number; oxiri: number};
export type RolikProps = {
	kadrlar: Kadr[];
	ovoz?: string | null;
	logo?: string | null;
	uslub: {urgu: string; urgu_matn: string; fon: string; siyoh: string};
	xz: {top: number; bottom: number; left: number; right: number};
	W: number; H: number; fps: number; davom: number;
};

const Fon: React.FC<{u: RolikProps['uslub']; W: number; H: number}> = ({u, W, H}) => {
	const f = useCurrentFrame();
	const {fps} = useVideoConfig();
	const t = f / fps;
	const doira = (x: number, y: number, r: number, o: number) => (
		<div style={{position: 'absolute', left: x - r, top: y - r, width: r * 2, height: r * 2, borderRadius: '50%',
			background: u.urgu, opacity: o, filter: `blur(${r * 0.35}px)`}} />
	);
	return (
		<AbsoluteFill style={{background: u.fon, overflow: 'hidden'}}>
			{doira(W * (0.15 + 0.05 * Math.sin(t * 0.6)), H * (0.2 + 0.03 * Math.cos(t * 0.5)), W * 0.35, 0.16)}
			{doira(W * (0.9 + 0.04 * Math.cos(t * 0.4)), H * (0.78 + 0.04 * Math.sin(t * 0.7)), W * 0.4, 0.12)}
		</AbsoluteFill>
	);
};

const KadrKo: React.FC<{k: Kadr; p: RolikProps; oxirgi: boolean}> = ({k, p, oxirgi}) => {
	const f = useCurrentFrame();
	const {fps, durationInFrames} = useVideoConfig();
	const {W, H, xz, uslub: u} = p;
	// *bir necha so'z* — yulduzchalar orasidagi hamma so'z urg'u rangida
	let ochiq = false;
	const sozlar = k.matn.split(/\s+/).filter(Boolean).map((s) => {
		const bosh = s.startsWith('*');
		const oxir = /\*[.,!?]*$/.test(s);
		const urgu = ochiq || bosh;
		if (bosh && !oxir) ochiq = true;
		if (oxir) ochiq = false;
		return {toza: s.replace(/\*/g, ''), urgu};
	});
	const qadam = Math.min(fps * 0.14, (durationInFrames * 0.55) / Math.max(1, sozlar.length));
	const chiq = oxirgi ? 1 : interpolate(f, [durationInFrames - 6, durationInFrames], [1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
	const yorliq = spring({frame: f, fps, config: {damping: 14}});
	const kenglik = W - xz.left - xz.right - W * 0.1;
	const uzun = k.matn.length;
	const size = W * (uzun > 90 ? 0.066 : uzun > 55 ? 0.078 : uzun > 30 ? 0.092 : 0.11);
	return (
		<AbsoluteFill style={{
			paddingTop: xz.top + H * 0.04, paddingBottom: xz.bottom, paddingLeft: xz.left + W * 0.05, paddingRight: xz.right + W * 0.05,
			justifyContent: 'center', opacity: chiq, transform: `translateY(${(1 - chiq) * -30}px)`,
		}}>
			{k.sarlavha ? (
				<div style={{alignSelf: 'flex-start', background: u.urgu, color: u.urgu_matn, fontFamily: 'MontB',
					fontSize: W * 0.035, padding: `${W * 0.012}px ${W * 0.03}px`, borderRadius: W * 0.05,
					textTransform: 'uppercase', letterSpacing: 2, marginBottom: H * 0.03,
					transform: `translateX(${(1 - yorliq) * -60}px)`, opacity: yorliq}}>
					{k.sarlavha}
				</div>
			) : null}
			<div style={{fontFamily: 'MontB', fontSize: size, lineHeight: 1.12, color: u.siyoh, maxWidth: kenglik,
				display: 'flex', flexWrap: 'wrap', columnGap: size * 0.28}}>
				{sozlar.map(({toza, urgu}, i) => {
					const kir = spring({frame: f - i * qadam, fps, config: {damping: 13, stiffness: 170}});
					return (
						<span key={i} style={{display: 'inline-block', opacity: Math.min(1, kir * 1.4),
							transform: `translateY(${(1 - kir) * size * 0.5}px) scale(${0.85 + 0.15 * kir})`,
							color: urgu ? u.urgu : u.siyoh}}>
							{toza}
						</span>
					);
				})}
			</div>
			{oxirgi && p.logo ? (
				<Img src={staticFile(p.logo)} style={{marginTop: H * 0.05, width: W * 0.34, alignSelf: 'center',
					opacity: interpolate(f, [fps * 0.3, fps * 0.8], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'})}} />
			) : null}
		</AbsoluteFill>
	);
};

export const Rolik: React.FC<RolikProps> = (p) => {
	shriftYukla();
	const {fps} = useVideoConfig();
	const f = useCurrentFrame();
	const {W, H, xz, uslub: u} = p;
	return (
		<AbsoluteFill>
			<Fon u={u} W={W} H={H} />
			{p.kadrlar.map((k, i) => {
				const from = Math.round(k.boshi * fps);
				const dur = Math.max(1, Math.round(k.oxiri * fps) - from);
				return (
					<Sequence key={i} from={from} durationInFrames={dur}>
						<KadrKo k={k} p={p} oxirgi={i === p.kadrlar.length - 1} />
					</Sequence>
				);
			})}
			{p.logo ? (
				<Img src={staticFile(p.logo)} style={{position: 'absolute', top: xz.top + H * 0.005, left: xz.left + W * 0.04,
					height: H * 0.035, opacity: 0.9}} />
			) : null}
			{/* pastki progress chizig'i — xavfsiz zona ustida */}
			<div style={{position: 'absolute', left: xz.left + W * 0.05, bottom: xz.bottom - H * 0.02, height: 6, borderRadius: 3,
				width: (W - xz.left - xz.right - W * 0.1) * Math.min(1, f / (p.davom * fps)), background: u.urgu, opacity: 0.8}} />
			{p.ovoz ? <Audio src={staticFile(p.ovoz)} /> : null}
		</AbsoluteFill>
	);
};
