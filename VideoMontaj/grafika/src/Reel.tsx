import React from 'react';
import {AbsoluteFill, Audio, Img, interpolate, OffthreadVideo, Sequence, spring, staticFile, useCurrentFrame, useVideoConfig, Easing} from 'remotion';
import {shriftYukla} from './shrift';

// Reel Studio: "gapiruvchi bosh" videosi + sahna rejasi (sahna.json) → tayyor Reels.
// Qoidalar: ~/VideoMontaj/QOIDALAR.md (xavfsiz zona, yuzga yozuv yo'q, stiker kesilmaydi...)

type Soz = {t: string; s: number; e: number};
type Blok = {s: number; e: number; sozlar: Soz[]};
type Joy = "yuqori-o'ng" | 'yuqori-chap' | 'yuqori-markaz' | "past-o'ng" | 'past-chap' | 'markaz';
export type Element =
	| {tur: 'stiker'; fayl?: string | null; emoji?: string; boshi: number; oxiri: number; joy?: Joy; fon?: 'doira'; olcham?: number}
	| {tur: 'logo'; fayl: string; boshi: number; oxiri: number; joy?: Joy; olcham?: number}
	| {tur: 'katta_soz'; matn: string; boshi: number; oxiri: number; glow?: boolean}
	| {tur: 'zoom'; boshi: number; oxiri: number; kuch?: number}
	| {tur: 'broll'; fayl: string; boshi: number; oxiri: number; joy?: 'toliq' | 'tepa' | 'karta'; boshlash?: number; sarlavha?: string}
	| {tur: 'vinyetka'; boshi: number; oxiri: number}
	| {tur: 'orqa_matn'; matn: string; boshi: number; oxiri: number; rang?: string}
	| {tur: 'egri_matn'; matn: string; boshi: number; oxiri: number; nur?: boolean}
	| {tur: 'avatarlar'; fayllar: string[]; matn?: string; boshi: number; oxiri: number}
	| {tur: 'pufak'; qatorlar: string[]; avatar?: string; boshi: number; oxiri: number}
	| {tur: 'raqamlar'; qatorlar: string[]; boshi: number; oxiri: number}
	| {tur: 'otish'; boshi: number; oxiri: number}
	| {tur: 'telefon'; boshi: number; oxiri: number; almash?: number; yomon?: string[]; yaxshi?: string[];
		yorliq_yomon?: string; yorliq_yaxshi?: string}
	| {tur: 'raqam'; qiymat: number; dan?: number; old?: string; qosh?: string; izoh?: string; boshi: number; oxiri: number}
	| {tur: 'solishtir'; chap: string; ong: string; chap_izoh?: string; ong_izoh?: string; boshi: number; oxiri: number}
	| {tur: 'royxat'; qatorlar: string[]; sarlavha?: string; boshi: number; oxiri: number}
	| {tur: 'generator'; markaz: string; chiqish: string[]; boshi: number; oxiri: number; bosish?: number}
	| {tur: 'cta'; sarlavha: string; izoh?: string; tugma: string; boshi: number; oxiri: number}
	| {tur: 'yozuv'; matn: string; kichik?: string; fon?: 'urgu' | 'qora' | 'oq' | 'yoq' | 'sut'; joy?: 'orta' | 'tepa' | 'past'; emoji?: string; boshi: number; oxiri: number}
	| {tur: 'kamera'; boshi: number; oxiri: number; kuch?: number; x?: number; y?: number} // ikkinchi "kamera": keskin yaqin kadr
	| {tur: 'kartochka'; matn: string; qatorlar?: number; rasm?: string; boshi: number; oxiri: number}
	| {tur: 'obuna'; handle: string; avatar?: string; bosish?: number; boshi: number; oxiri: number}
	| {tur: 'tanishtiruv'; tepa: string; pastki: string; boshi: number; oxiri: number}
	| {tur: 'hisoblar'; qatorlar: {qiymat: number; old?: string; qosh?: string; izoh: string}[]; boshi: number; oxiri: number}
	| {tur: 'oq_qora'; boshi: number; oxiri: number; ramka?: boolean};
type Yuz = {t: number; x?: number; y?: number; w?: number; h?: number; tepa: number};
export type ReelProps = {
	video: string;
	W: number; H: number; fps: number; davom: number;
	xz: {top: number; bottom: number; left: number; right: number};
	uslub: {urgu: string; urgu_matn: string; subtitr: string};
	subtitr_yoq?: boolean;
	fon_grid?: string; // oq ekranlar uchun to'r foni (x5 AE loyihasidan) // Umida uslubi: so'zma-so'z subtitr o'rniga ibora yozuvlari
	ovozlar?: {fayl: string; boshi: number; balandlik?: number}[]; // ovoz effektlari (Mixkit)
	subtitr: Blok[];
	hook?: {matn: string; kichik?: string; boshi: number; oxiri: number; glow?: boolean} | null;
	elementlar: Element[];
	joylash?: 'cover' | 'fit';
	manba?: {w: number; h: number}; // fit = gorizontal video o'rtada, orqasi xira nusxa
	odam?: string | null; // odam qatlami (shaffof webm) — "orqa_matn"/"egri_matn" uchun
	yuz?: Yuz[]; // yuz o'rni (0..1) — yozuv va stiker yuzga tushmasin
};

// t paytidagi yuz (eng yaqin yozuv); yuz topilmasa oldingi/keyingisi
const yuzAt = (p: ReelProps, t: number): {x: number; y: number; w: number; h: number; tepa: number} | null => {
	const ys = p.yuz;
	if (!ys || !ys.length) return null;
	let best: Yuz | null = null;
	for (const y of ys) {
		if (y.w === undefined) continue;
		if (!best || Math.abs(y.t - t) < Math.abs(best.t - t)) best = y;
	}
	return best ? {x: best.x!, y: best.y!, w: best.w!, h: best.h!, tepa: best.tepa} : null;
};

const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;
// Matn hech qachon kesilmaydi: eng uzun so'z mavjud kenglikka sig'adigan o'lcham (Montserrat Black ≈ 0.72em/harf)
const sigdir = (matn: string, size: number, kenglik: number) => {
	const eng = Math.max(1, ...matn.split(/\s+/).map((w) => w.length));
	return Math.min(size, kenglik / (eng * 0.72));
};
// Qisqa matn (≤ 14 belgi) — bitta qatorga sig'adigan o'lcham; uzunida — so'z bo'yicha sig'dirish
const qatorlab = (matn: string, size: number, kenglik: number) => {
	if (matn.length <= 14) {
		const s1 = Math.min(size, kenglik / (matn.length * 0.72));
		return {size: s1, qator: 1};
	}
	const s2 = sigdir(matn, size, kenglik);
	return {size: s2, qator: Math.ceil((matn.length * s2 * 0.72) / kenglik)};
};
const faol = (t: number, e: {boshi: number; oxiri: number}) => t >= e.boshi && t < e.oxiri;
const kontur = (px: number, rang = '#000') =>
	[[1, 0], [-1, 0], [0, 1], [0, -1], [0.7, 0.7], [-0.7, 0.7], [0.7, -0.7], [-0.7, -0.7]]
		.map(([x, y]) => `${x * px}px ${y * px}px 0 ${rang}`).join(',');

// Kirish/chiqish: 0→1→0 (spring kirish, 6 kadr chiqish)
const useKirish = (boshi: number, oxiri: number) => {
	const f = useCurrentFrame();
	const {fps} = useVideoConfig();
	const k = spring({frame: f - Math.round(boshi * fps), fps, config: {damping: 11, stiffness: 190, mass: 0.7}});
	const c = interpolate(f, [oxiri * fps - 6, oxiri * fps], [1, 0], clamp);
	return {k, c};
};

const Asosiy: React.FC<{p: ReelProps; t: number; odam?: boolean}> = ({p, t, odam}) => {
	// zoom (punch-in): 0.25 s kirish, ushlab turish, 0.25 s chiqish
	let s = 1;
	for (const e of p.elementlar) {
		if (e.tur !== 'zoom') continue;
		const kuch = e.kuch ?? 1.12;
		const a = interpolate(t, [e.boshi, e.boshi + 0.25, e.oxiri - 0.25, e.oxiri], [0, 1, 1, 0], {...clamp, easing: Easing.inOut(Easing.cubic)});
		s = Math.max(s, 1 + (kuch - 1) * a);
	}
	// kamera: ikkinchi ракурс (yaqin kadr) — o'tishsiz, keskin kesish; markaz (x, y) — yuz atrofi
	const kam = p.elementlar.find((e) => e.tur === 'kamera' && faol(t, e)) as Extract<Element, {tur: 'kamera'}> | undefined;
	if (kam) s *= kam.kuch ?? 1.3;
	const origin = kam ? `${(kam.x ?? 0.5) * 100}% ${(kam.y ?? 0.32) * 100}%` : '50% 38%';
	const split = p.elementlar.find((e) => e.tur === 'broll' && e.joy === 'tepa' && faol(t, e));
	if (odam && split) return null;
	// telefon/generator paytida fon xiralashadi (0.25 s kirish/chiqish)
	const oq = p.elementlar.some((e) => e.tur === 'oq_qora' && faol(t, e));
	let xira = 0;
	for (const e of p.elementlar) {
		if (e.tur !== 'telefon' && e.tur !== 'generator') continue;
		xira = Math.max(xira, interpolate(t, [e.boshi, e.boshi + 0.25, e.oxiri - 0.2, e.oxiri], [0, 1, 1, 0], clamp));
	}
	return (
		<AbsoluteFill style={split ? {top: p.H / 2, height: p.H / 2, overflow: 'hidden'} : {overflow: 'hidden'}}>
			{p.joylash === 'fit' && !odam ? (
				<OffthreadVideo src={staticFile(p.video)} muted style={{width: '100%', height: '100%', objectFit: 'cover',
					filter: 'blur(40px) brightness(0.55)', transform: 'scale(1.15)'}} />
			) : null}
			<AbsoluteFill>
				<OffthreadVideo src={staticFile(odam ? (p.odam as string) : p.video)} transparent={!!odam} muted={!!odam}
					style={{width: '100%', height: '100%', objectFit: p.joylash === 'fit' ? 'contain' : 'cover',
						transform: `scale(${s * (1 + 0.08 * xira)})`, transformOrigin: origin,
						filter: [xira > 0 ? `blur(${14 * xira}px) brightness(${1 - 0.5 * xira})` : '', oq ? 'grayscale(1) contrast(1.1)' : ''].join(' ').trim() || undefined}} />
			</AbsoluteFill>
		</AbsoluteFill>
	);
};

const Broll: React.FC<{e: Extract<Element, {tur: 'broll'}>; p: ReelProps}> = ({e, p}) => {
	const f = useCurrentFrame();
	const {fps} = useVideoConfig();
	const {k, c} = useKirish(e.boshi, e.oxiri);
	const start = Math.round(((e.boshlash ?? 0) + 0) * fps);
	const vid = (
		<OffthreadVideo src={staticFile(e.fayl)} muted startFrom={start} style={{width: '100%', height: '100%', objectFit: 'cover'}} />
	);
	const joy = e.joy ?? 'toliq';
	if (joy === 'tepa') {
		return (
			<AbsoluteFill style={{height: p.H / 2, overflow: 'hidden', opacity: c}}>
				{vid}
				{e.sarlavha ? (
					<div style={{position: 'absolute', bottom: 0, left: 0, right: 0, background: '#C8102E', color: '#fff',
						fontFamily: 'MontB', fontSize: p.W * 0.05, textAlign: 'center', padding: `${p.W * 0.012}px 0`}}>{e.sarlavha}</div>
				) : null}
			</AbsoluteFill>
		);
	}
	if (joy === 'karta') {
		const w = p.W * 0.78;
		return (
			<AbsoluteFill style={{alignItems: 'center', paddingTop: p.xz.top + p.H * 0.02, opacity: c}}>
				<div style={{width: w, height: w * 1.25, borderRadius: p.W * 0.04, overflow: 'hidden',
					transform: `scale(${0.8 + 0.2 * k}) rotate(${(1 - k) * -4}deg)`, boxShadow: '0 30px 80px rgba(0,0,0,.5)', border: '6px solid #fff'}}>
					{vid}
				</div>
			</AbsoluteFill>
		);
	}
	// to'liq b-roll biroz qoraytiriladi — ustidagi subtitr o'qilsin (subtitrsiz uslubda — asl yorqinlikda, namunadagidek)
	return <AbsoluteFill style={{opacity: Math.min(1, k * 2) * c, filter: p.subtitr_yoq ? undefined : 'brightness(0.62) saturate(0.9)'}}>{vid}</AbsoluteFill>;
};

const kesishadi = (a: {x: number; y: number; w: number; h: number}, b: {x: number; y: number; w: number; h: number}) =>
	a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

const joyXY = (joy: Joy | undefined, S: number, p: ReelProps, t = 0) => {
	const {W, H, xz} = p;
	const m = W * 0.03;
	const x = (joy ?? "yuqori-o'ng").endsWith('chap') ? xz.left + m
		: (joy ?? '').endsWith('markaz') || joy === 'markaz' ? (W - S) / 2
		: W - xz.right - S - m;
	let y = (joy ?? '').startsWith('past') ? H * 0.56 : joy === 'markaz' ? (H - S) / 2 : Math.max(xz.top + H * 0.02, H * 0.2);
	// stiker hech qachon kesilmaydi va xavfsiz zonadan chiqmaydi
	y = Math.min(Math.max(y, xz.top), H - xz.bottom - S);
	let X = Math.min(Math.max(x, xz.left), W - xz.right - S);
	// yuzga tushmasin: avval qarama-qarshi tomonga, bo'lmasa yuz ostiga
	const yz = yuzAt(p, t);
	if (yz) {
		const f = {x: (yz.x - yz.w * 0.1) * W, y: (yz.y - yz.h * 0.15) * H, w: yz.w * 1.2 * W, h: yz.h * 1.3 * H};
		if (kesishadi({x: X, y, w: S, h: S}, f)) {
			const chap = xz.left + m, ong = W - xz.right - S - m;
			const bosh = [X > W / 2 ? chap : ong, X > W / 2 ? ong : chap].find((x2) => !kesishadi({x: x2, y, w: S, h: S}, f));
			if (bosh !== undefined) X = bosh;
			// yuz ostiga, lekin subtitr zonasidan (pastki ~14%) yuqorida
			else y = Math.min(f.y + f.h + H * 0.01, H - xz.bottom - H * 0.14 - S);
		}
	}
	return {x: X, y};
};

const Stiker: React.FC<{e: Extract<Element, {tur: 'stiker' | 'logo'}>; p: ReelProps}> = ({e, p}) => {
	const f = useCurrentFrame();
	const {fps} = useVideoConfig();
	const {k, c} = useKirish(e.boshi, e.oxiri);
	const S = p.W * (e.olcham ?? (e.tur === 'logo' ? 0.22 : 0.3));
	const {x, y} = joyXY(e.joy, S, p, e.boshi + 0.3);
	const teb = Math.sin((f / fps) * Math.PI * 2 * 0.9) * 5 * k;
	const doira = e.tur === 'stiker' && e.fon === 'doira';
	const ichki = e.tur === 'stiker' && !e.fayl
		? <div style={{fontSize: S * 0.8, lineHeight: 1, fontFamily: '"Apple Color Emoji"', textAlign: 'center'}}>{e.emoji ?? '🔥'}</div>
		: <Img src={staticFile(e.fayl as string)} style={{width: doira ? '64%' : '100%', height: doira ? '64%' : '100%', objectFit: 'contain'}} />;
	return (
		<div style={{position: 'absolute', left: x, top: y, width: S, height: S, display: 'flex', alignItems: 'center', justifyContent: 'center',
			transform: `scale(${k * c}) rotate(${-12 + 12 * k + teb}deg)`,
			filter: `drop-shadow(0 ${S * 0.04}px ${S * 0.08}px rgba(0,0,0,.45))`,
			...(doira || e.tur === 'logo' ? {background: '#fff', borderRadius: e.tur === 'logo' ? S * 0.22 : '50%'} : {})}}>
			{ichki}
		</div>
	);
};

// Matn tepada yuzga sig'maydimi → yuz (iyak) ostiga tushadi
const matnTepa = (p: ReelProps, t: number, balandlik: number) => {
	const top = p.xz.top + p.H * 0.02;
	const yz = yuzAt(p, t);
	if (!yz) return top;
	const yuzTepa = (yz.y - yz.h * 0.05) * p.H;
	if (top + balandlik <= yuzTepa) return top;
	return Math.max(p.xz.top, Math.min((yz.y + yz.h * 1.1) * p.H, p.H - p.xz.bottom - p.H * 0.02 - balandlik));
};

const KattaSoz: React.FC<{e: Extract<Element, {tur: 'katta_soz'}>; p: ReelProps}> = ({e, p}) => {
	const {k, c} = useKirish(e.boshi, e.oxiri);
	const {size, qator} = qatorlab(e.matn, p.W * (e.matn.length > 8 ? 0.13 : 0.17), p.W - p.xz.left - p.xz.right - p.W * 0.06);
	return (
		<AbsoluteFill style={{alignItems: 'center', paddingTop: matnTepa(p, e.boshi + 0.3, size * 1.05 * qator), opacity: c}}>
			<div style={{fontFamily: 'MontB', fontSize: size, color: '#fff', textTransform: 'uppercase', lineHeight: 1,
				transform: `scale(${1.35 - 0.35 * k})`, opacity: Math.min(1, k * 1.5), filter: `blur(${(1 - k) * 8}px)`,
				textShadow: e.glow ? `0 0 ${size * 0.15}px ${p.uslub.urgu}, 0 0 ${size * 0.4}px ${p.uslub.urgu}` : kontur(size * 0.03),
				maxWidth: p.W - p.xz.left - p.xz.right - p.W * 0.06, textAlign: 'center'}}>
				{e.matn}
			</div>
		</AbsoluteFill>
	);
};

const Hook: React.FC<{h: NonNullable<ReelProps['hook']>; p: ReelProps}> = ({h, p}) => {
	const f = useCurrentFrame();
	const {fps} = useVideoConfig();
	const {k, c} = useKirish(h.boshi, h.oxiri);
	const k2 = spring({frame: f - Math.round(h.boshi * fps) - 4, fps, config: {damping: 12}});
	const uzun = h.matn.length;
	const {size, qator} = qatorlab(h.matn, p.W * (uzun > 22 ? 0.085 : uzun > 12 ? 0.11 : 0.15), p.W - p.xz.left - p.xz.right - p.W * 0.06);
	const glow = h.glow ?? true;
	return (
		<AbsoluteFill style={{alignItems: 'center', opacity: c,
			paddingTop: matnTepa(p, h.boshi + 0.3, size * 0.95 * qator + (h.kichik ? p.W * 0.065 : 0)),
			paddingLeft: p.xz.left + p.W * 0.03, paddingRight: p.xz.right + p.W * 0.03}}>
			{h.kichik ? (
				<div style={{fontFamily: 'MontX', fontSize: p.W * 0.05, color: '#fff', opacity: k, transform: `translateY(${(1 - k) * 20}px)`,
					textShadow: kontur(2)}}>{h.kichik}</div>
			) : null}
			<div style={{fontFamily: 'MontB', fontSize: size, lineHeight: 0.95, color: '#fff', textTransform: 'uppercase', textAlign: 'center',
				transform: `scale(${0.7 + 0.3 * k2})`, opacity: Math.min(1, k2 * 1.4), letterSpacing: -1,
				textShadow: glow ? `${kontur(size * 0.025)}, 0 0 ${size * 0.25}px ${p.uslub.urgu}` : kontur(size * 0.03)}}>
				{h.matn}
			</div>
		</AbsoluteFill>
	);
};

const Subtitr: React.FC<{p: ReelProps; t: number}> = ({p, t}) => {
	const f = useCurrentFrame();
	const {fps} = useVideoConfig();
	const b = p.subtitr.find((x) => t >= x.s && t < x.e);
	if (!b || p.subtitr_yoq || p.elementlar.some((e) => (e.tur === 'pufak' || e.tur === 'royxat' || e.tur === 'cta' || e.tur === 'tanishtiruv') && faol(t, e))) return null;
	const kir = spring({frame: f - Math.round(b.s * fps), fps, config: {damping: 14, stiffness: 220}});
	// eng uzun so'z ham kadrdan chiqmasin (joriy so'z 1.08x kattalashadi)
	const size = sigdir(b.sozlar.map((w) => w.t).join(' '), p.W * 0.078, (p.W - p.xz.left - p.xz.right - p.W * 0.08) / 1.1);
	// fit rejimda subtitr video ostidagi bo'sh joyga (videoning ustiga emas)
	const vidPast = p.joylash === 'fit' && p.manba ? (p.H + (p.W * p.manba.h) / p.manba.w) / 2 : 0;
	const fitTepa = vidPast && vidPast + p.H * 0.02 + size * 2.4 < p.H - p.xz.bottom ? vidPast + p.H * 0.02 : 0;
	return (
		<AbsoluteFill style={{justifyContent: fitTepa ? 'flex-start' : 'flex-end', alignItems: 'center',
			paddingTop: fitTepa || undefined, paddingBottom: p.xz.bottom + p.H * 0.03,
			paddingLeft: p.xz.left + p.W * 0.04, paddingRight: p.xz.right + p.W * 0.04}}>
			<div style={{fontFamily: 'MontB', fontSize: size, lineHeight: 1.1, textTransform: 'uppercase', textAlign: 'center',
				transform: `scale(${0.85 + 0.15 * kir})`, display: 'flex', flexWrap: 'wrap', justifyContent: 'center', columnGap: size * 0.25}}>
				{b.sozlar.map((w, i) => {
					const joriy = t >= w.s && (i === b.sozlar.length - 1 || t < b.sozlar[i + 1].s);
					return (
						<span key={i} style={{color: joriy ? p.uslub.urgu : p.uslub.subtitr, textShadow: kontur(size * 0.045),
							transform: joriy ? 'scale(1.08)' : 'none', display: 'inline-block'}}>{w.t}</span>
					);
				})}
			</div>
		</AbsoluteFill>
	);
};

// Odam ORQASIDAGI ulkan matn (namuna 13 "HI") — odam qatlami ustidan yopadi
const OrqaMatn: React.FC<{e: Extract<Element, {tur: 'orqa_matn'}>; p: ReelProps}> = ({e, p}) => {
	const {k, c} = useKirish(e.boshi, e.oxiri);
	const yz = yuzAt(p, e.boshi + 0.3);
	const size = sigdir(e.matn, p.W * 0.5, p.W * 0.9);
	const markazY = yz ? Math.max(yz.tepa * p.H + size * 0.55, p.xz.top + size * 0.5) : p.H * 0.3;
	return (
		<AbsoluteFill style={{alignItems: 'center', opacity: c}}>
			<div style={{position: 'absolute', top: markazY - size * 0.55, fontFamily: 'MontB', fontSize: size, lineHeight: 1,
				color: e.rang ?? '#F2F2F2', textTransform: 'uppercase', letterSpacing: -size * 0.02,
				transform: `translateY(${(1 - k) * size * 0.3}px) scale(${0.9 + 0.1 * k})`, opacity: Math.min(1, k * 1.5)}}>
				{e.matn}
			</div>
		</AbsoluteFill>
	);
};

// Bosh atrofidagi egri (yoy) matn + orqada to'q sariq nur (namuna 05)
const EgriMatn: React.FC<{e: Extract<Element, {tur: 'egri_matn'}>; p: ReelProps; qism: 'nur' | 'matn'}> = ({e, p, qism}) => {
	const f = useCurrentFrame();
	const {fps} = useVideoConfig();
	const {k, c} = useKirish(e.boshi, e.oxiri);
	const yz = yuzAt(p, e.boshi + 0.3) ?? {x: 0.35, y: 0.28, w: 0.3, h: 0.17, tepa: 0.22};
	const cx = (yz.x + yz.w / 2) * p.W, cy = (yz.y + yz.h / 2) * p.H;
	const R = Math.max(yz.w * p.W * 1.05, p.W * 0.26);
	if (qism === 'nur') {
		if (e.nur === false) return null;
		const r = R * 1.25 * (0.85 + 0.15 * k);
		return (
			<div style={{position: 'absolute', left: cx - r, top: cy - r, width: r * 2, height: r * 2, borderRadius: '50%', opacity: 0.9 * c * Math.min(1, k * 1.5),
				background: 'radial-gradient(circle, #FF8A00 0%, #FF6A00 45%, rgba(255,90,0,.35) 62%, rgba(255,90,0,0) 72%)'}} />
		);
	}
	const size = p.W * 0.062;
	const aylan = interpolate(f, [e.boshi * fps, e.oxiri * fps], [-8, 8], clamp);
	const id = `yoy${Math.round(e.boshi * 100)}`;
	return (
		<svg width={p.W} height={p.H} style={{position: 'absolute', left: 0, top: 0, opacity: c * Math.min(1, k * 1.4)}}>
			<defs>
				<path id={id} d={`M ${cx - R} ${cy} A ${R} ${R} 0 0 1 ${cx + R} ${cy}`} />
			</defs>
			<text style={{fontFamily: 'MontB', fontSize: size, fill: '#fff', letterSpacing: 2}}
				transform={`rotate(${aylan} ${cx} ${cy})`} filter="drop-shadow(0 4px 10px rgba(0,0,0,.5))">
				<textPath href={`#${id}`} startOffset="50%" textAnchor="middle">{e.matn}</textPath>
			</text>
		</svg>
	);
};

// Bir-birini yopgan aylana avatarlar qatori (namuna 12)
const Avatarlar: React.FC<{e: Extract<Element, {tur: 'avatarlar'}>; p: ReelProps}> = ({e, p}) => {
	const f = useCurrentFrame();
	const {fps} = useVideoConfig();
	const {c} = useKirish(e.boshi, e.oxiri);
	const n = e.fayllar.length;
	const D = Math.min(p.W * 0.2, (p.W - p.xz.left - p.xz.right - p.W * 0.08) / (1 + (n - 1) * 0.72));
	const yz = yuzAt(p, e.boshi + 0.3);
	const top = yz ? Math.min((yz.y + yz.h * 1.25) * p.H, p.H - p.xz.bottom - D - p.H * 0.12) : p.H * 0.45;
	return (
		<AbsoluteFill style={{alignItems: 'center', opacity: c}}>
			{e.matn ? <div style={{position: 'absolute', top: top - p.W * 0.075, fontFamily: 'MontB', fontSize: p.W * 0.06, color: '#fff', textShadow: kontur(3)}}>{e.matn}</div> : null}
			<div style={{position: 'absolute', top, display: 'flex'}}>
				{e.fayllar.map((fl, i) => {
					const k = spring({frame: f - Math.round(e.boshi * fps) - i * 3, fps, config: {damping: 12}});
					return (
						<Img key={i} src={staticFile(fl)} style={{width: D, height: D, borderRadius: '50%', objectFit: 'cover', border: `${D * 0.04}px solid #fff`,
							marginLeft: i ? -D * 0.28 : 0, transform: `scale(${k})`, boxShadow: '0 8px 24px rgba(0,0,0,.45)', zIndex: n - i}} />
					);
				})}
			</div>
		</AbsoluteFill>
	);
};

// Chat pufakchalari + aylana avatar (namuna 03)
const Pufak: React.FC<{e: Extract<Element, {tur: 'pufak'}>; p: ReelProps}> = ({e, p}) => {
	const f = useCurrentFrame();
	const {fps} = useVideoConfig();
	const {k, c} = useKirish(e.boshi, e.oxiri);
	// avatar bo'sh joyga qarab kichrayadi (yuz ostidan pastki xavfsiz zonagacha)
	const yz = yuzAt(p, e.boshi + 0.3);
	const pufakH = e.qatorlar.length * p.W * 0.115;
	const bosh = yz ? p.H - p.xz.bottom - (yz.y + yz.h * 1.1) * p.H - p.H * 0.02 : p.H;
	const D = e.avatar ? Math.max(p.W * 0.16, Math.min(p.W * 0.34, bosh - pufakH - p.H * 0.03)) : 0;
	const qadam = Math.min(12, Math.max(4, Math.round(((e.oxiri - e.boshi) * fps * 0.5) / Math.max(1, e.qatorlar.length))));
	return (
		<AbsoluteFill style={{alignItems: 'center', opacity: c,
			paddingTop: matnTepa(p, e.boshi + 0.3, D + pufakH)}}>
			{e.avatar ? (
				<Img src={staticFile(e.avatar)} style={{width: D, height: D, borderRadius: '50%', objectFit: 'cover', border: `${D * 0.03}px solid ${p.uslub.urgu}`,
					transform: `scale(${k})`, boxShadow: '0 10px 30px rgba(0,0,0,.35)'}} />
			) : null}
			<div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: p.H * 0.02, gap: p.H * 0.008}}>
				{e.qatorlar.map((q, i) => {
					const kk = spring({frame: f - Math.round(e.boshi * fps) - (i + 1) * qadam, fps, config: {damping: 12}});
					return (
						<div key={i} style={{fontFamily: 'MontX', fontSize: p.W * 0.07, color: '#111', padding: `${p.W * 0.012}px ${p.W * 0.035}px`,
							borderRadius: p.W * 0.03, background: i % 2 ? '#D9D9D9' : p.uslub.urgu, transform: `scale(${kk}) translateX(${i % 2 ? p.W * 0.06 : -p.W * 0.02}px)`,
							opacity: kk, boxShadow: '0 6px 18px rgba(0,0,0,.25)'}}>{q}</div>
					);
				})}
			</div>
		</AbsoluteFill>
	);
};

// 1-2-3 kartochkalar birin-ketin sakrab chiqadi ("shu uchta ...")
const Raqamlar: React.FC<{e: Extract<Element, {tur: 'raqamlar'}>; p: ReelProps}> = ({e, p}) => {
	const f = useCurrentFrame();
	const {fps} = useVideoConfig();
	const {c} = useKirish(e.boshi, e.oxiri);
	const n = e.qatorlar.length;
	const D = Math.min(p.W * 0.2, (p.W - p.xz.left - p.xz.right - p.W * 0.1) / (n + (n - 1) * 0.25));
	const qadam = Math.max(3, Math.round(((e.oxiri - e.boshi) * fps * 0.45) / n));
	return (
		<AbsoluteFill style={{alignItems: 'center', paddingTop: matnTepa(p, e.boshi + 0.3, D * 1.1), opacity: c}}>
			<div style={{display: 'flex', gap: D * 0.25}}>
				{e.qatorlar.map((q, i) => {
					const k = spring({frame: f - Math.round(e.boshi * fps) - i * qadam, fps, config: {damping: 9, stiffness: 200, mass: 0.6}});
					const faolK = interpolate(f - Math.round(e.boshi * fps) - i * qadam, [0, 6, 14], [0, 1, 0.35], clamp);
					return (
						<div key={i} style={{width: D, height: D, borderRadius: D * 0.24, background: p.uslub.urgu, color: p.uslub.urgu_matn,
							display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'MontB', fontSize: D * 0.62,
							transform: `translateY(${(1 - k) * -D * 0.8}px) scale(${k}) rotate(${(1 - k) * (i % 2 ? 20 : -20)}deg)`,
							boxShadow: `0 ${D * 0.08}px ${D * 0.25}px rgba(0,0,0,.4), 0 0 ${D * 0.5 * faolK}px ${p.uslub.urgu}`}}>{q}</div>
					);
				})}
			</div>
		</AbsoluteFill>
	);
};

// O'tish: oq chaqnash + radial chiziqlar (kesish joyida)
const Otish: React.FC<{e: Extract<Element, {tur: 'otish'}>; p: ReelProps}> = ({e, p}) => {
	const f = useCurrentFrame();
	const {fps} = useVideoConfig();
	const o = interpolate(f / fps, [e.boshi, e.boshi + 0.06, e.oxiri], [0, 0.85, 0], clamp);
	const r = interpolate(f / fps, [e.boshi, e.oxiri], [0.2, 1.4], clamp);
	return (
		<AbsoluteFill style={{pointerEvents: 'none'}}>
			<AbsoluteFill style={{background: '#fff', opacity: o * 0.8}} />
			<AbsoluteFill style={{opacity: o, background: `repeating-conic-gradient(from 0deg at 50% 40%, rgba(255,255,255,.0) 0deg 6deg, rgba(255,255,255,.55) 6deg 8deg)`,
				maskImage: `radial-gradient(circle at 50% 40%, transparent ${r * 30}%, black ${r * 60}%)`, WebkitMaskImage: `radial-gradient(circle at 50% 40%, transparent ${r * 30}%, black ${r * 60}%)`}} />
		</AbsoluteFill>
	);
};

// Telefon: stories misoli — avval tiqilib yozilgan matn → ❌ muhr → toza 2 gap → ✅
const Telefon: React.FC<{e: Extract<Element, {tur: 'telefon'}>; p: ReelProps}> = ({e, p}) => {
	const f = useCurrentFrame();
	const {fps} = useVideoConfig();
	const t = f / fps;
	const {k, c} = useKirish(e.boshi, e.oxiri);
	const almash = e.almash ?? (e.boshi + e.oxiri) / 2;
	const yomon = e.yomon ?? ['Assalomu alaykum, bugun sizga juda muhim', 'bir narsani aytib bermoqchiman, oxirigacha', "o'qing, chunki bu mavzu hammaga kerak va", "men buni ko'p yillik tajribamdan kelib", 'chiqib yozyapman, fikringizni ham qoldiring'];
	const yaxshi = e.yaxshi ?? ['Bu xatoni', 'hamma qiladi 👇'];
	// telefon: yorliq tepa xavfsiz zonadan pastda, telefon subtitr zonasidan (pastki ~12%) yuqorida
	const PW = Math.min(p.W * 0.42, (p.H - p.xz.top - p.xz.bottom - p.H * 0.14) / 2.25), PH = PW * 2.05;
	const top = p.xz.top + PW * 0.2 + Math.max(0, (p.H - p.xz.top - p.xz.bottom - p.H * 0.14 - PH - PW * 0.2) / 2);
	const ichki = PW * 0.05;
	const bosqich2 = t >= almash;
	const t2 = spring({frame: f - Math.round(almash * fps), fps, config: {damping: 12}});
	// ❌ muhr — 1-bosqich oxirida
	const muhrT = almash - 0.75;
	const muhr = spring({frame: f - Math.round(muhrT * fps), fps, config: {damping: 8, stiffness: 220}});
	const silk = t > muhrT && t < muhrT + 0.35 ? Math.sin((t - muhrT) * 60) * 10 * (1 - (t - muhrT) / 0.35) : 0;
	const qatorVaqt = (i: number) => e.boshi + 0.35 + i * Math.max(0.12, (muhrT - e.boshi - 0.5) / yomon.length);
	const yorliq = bosqich2 ? (e.yorliq_yaxshi ?? '✅ ZOOMERCHA') : (e.yorliq_yomon ?? '❌ ESKICHA');
	return (
		<AbsoluteFill style={{opacity: c}}>
			{/* fon: video xiralashadi — ko'z telefonda */}
			<div style={{position: 'absolute', left: (p.W - PW) / 2, top, width: PW,
				transform: `translateY(${(1 - k) * p.H * 0.5}px) rotate(${(1 - k) * -8 + silk * 0.3}deg) translateX(${silk}px) scale(${bosqich2 ? 0.94 + 0.06 * t2 : 1})`}}>
				{/* yorliq */}
				<div style={{position: 'absolute', top: -PW * 0.17, left: 0, right: 0, textAlign: 'center'}}>
					<span style={{fontFamily: 'MontB', fontSize: PW * 0.085, color: '#fff', padding: `${PW * 0.015}px ${PW * 0.05}px`, borderRadius: PW * 0.05,
						background: bosqich2 ? '#16A34A' : '#DC2626', boxShadow: '0 6px 20px rgba(0,0,0,.35)'}}>{yorliq}</span>
				</div>
				<div style={{width: PW, height: PH, borderRadius: PW * 0.13, background: '#0b0b0b', padding: PW * 0.03, boxShadow: '0 40px 90px rgba(0,0,0,.6)'}}>
					<div style={{position: 'relative', width: '100%', height: '100%', borderRadius: PW * 0.1, overflow: 'hidden',
						background: bosqich2 ? `linear-gradient(160deg, #111827, #1f2937)` : 'linear-gradient(160deg, #7C3AED, #DB2777 55%, #F59E0B)'}}>
						{/* stories chiziqlari va profil */}
						<div style={{position: 'absolute', top: ichki, left: ichki, right: ichki, display: 'flex', gap: 4}}>
							{[0, 1, 2].map((i) => <div key={i} style={{flex: 1, height: 4, borderRadius: 2, background: i === 0 ? '#fff' : 'rgba(255,255,255,.4)'}} />)}
						</div>
						<div style={{position: 'absolute', top: ichki * 1.8, left: ichki, display: 'flex', alignItems: 'center', gap: ichki * 0.5}}>
							<div style={{width: PW * 0.1, height: PW * 0.1, borderRadius: '50%', background: '#fff', opacity: 0.9}} />
							<div style={{width: PW * 0.3, height: PW * 0.03, borderRadius: 4, background: 'rgba(255,255,255,.85)'}} />
						</div>
						{!bosqich2 ? (
							<div style={{position: 'absolute', top: PH * 0.2, left: ichki, right: ichki, display: 'flex', flexDirection: 'column', gap: PW * 0.02}}>
								{yomon.map((q, i) => {
									const kk = interpolate(t, [qatorVaqt(i), qatorVaqt(i) + 0.12], [0, 1], clamp);
									return <div key={i} style={{fontFamily: 'MontX', fontSize: PW * 0.052, lineHeight: 1.2, color: '#fff', opacity: kk,
										transform: `translateY(${(1 - kk) * 10}px)`, background: 'rgba(0,0,0,.25)', padding: '2px 6px', borderRadius: 4}}>{q}</div>;
								})}
							</div>
						) : (
							<div style={{position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: PW * 0.03}}>
								{yaxshi.map((q, i) => {
									const kk = spring({frame: f - Math.round(almash * fps) - 4 - i * 5, fps, config: {damping: 11}});
									return <div key={i} style={{fontFamily: 'MontB', fontSize: PW * 0.12, color: i === 0 ? '#fff' : p.uslub.urgu, textAlign: 'center',
										transform: `scale(${kk})`, opacity: kk, textShadow: '0 4px 14px rgba(0,0,0,.5)'}}>{q}</div>;
								})}
							</div>
						)}
						{/* ❌ muhr */}
						{!bosqich2 && t >= muhrT ? (
							<AbsoluteFill style={{alignItems: 'center', justifyContent: 'center', background: `rgba(220,38,38,${0.25 * muhr})`}}>
								<svg width={PW * 0.62} height={PW * 0.62} viewBox="0 0 100 100" style={{transform: `scale(${2.2 - 1.2 * muhr}) rotate(${(1 - muhr) * 25 - 8}deg)`,
									opacity: Math.min(1, muhr * 1.5), filter: 'drop-shadow(0 8px 18px rgba(0,0,0,.45))'}}>
									<circle cx="50" cy="50" r="44" fill="none" stroke="#EF4444" strokeWidth="9" />
									<path d="M32 32 L68 68 M68 32 L32 68" stroke="#EF4444" strokeWidth="12" strokeLinecap="round" />
								</svg>
							</AbsoluteFill>
						) : null}
					</div>
				</div>
				{/* ✅ nishon */}
				{bosqich2 ? (
					<div style={{position: 'absolute', right: -PW * 0.1, bottom: PH * 0.08, fontSize: PW * 0.3, fontFamily: '"Apple Color Emoji"',
						transform: `scale(${spring({frame: f - Math.round(almash * fps) - 10, fps, config: {damping: 8}})}) rotate(-10deg)`}}>✅</div>
				) : null}
			</div>
		</AbsoluteFill>
	);
};

const bosh = (e: {boshi: number}, fps: number) => Math.round(e.boshi * fps);
const oyna = {background: 'rgba(15,15,20,.62)', backdropFilter: 'blur(14px)', border: '1.5px solid rgba(255,255,255,.18)'} as const;

// Katta summa sanab chiqadi: $0 → $3 000+
const Raqam: React.FC<{e: Extract<Element, {tur: 'raqam'}>; p: ReelProps}> = ({e, p}) => {
	const f = useCurrentFrame();
	const {fps} = useVideoConfig();
	const {k, c} = useKirish(e.boshi, e.oxiri);
	const x = interpolate(f - bosh(e, fps), [0, fps * 0.9], [0, 1], {...clamp, easing: Easing.out(Easing.cubic)});
	const son = Math.round((e.dan ?? 0) + (e.qiymat - (e.dan ?? 0)) * x);
	const matn = `${e.old ?? ''}${son.toLocaleString('ru-RU').replace(/\u00a0/g, ' ')}${x >= 1 ? e.qosh ?? '' : ''}`;
	const size = Math.min(p.W * 0.2, (p.W - p.xz.left - p.xz.right - p.W * 0.1) / (Math.max(5, matn.length + 1) * 0.66));
	const tepa = matnTepa(p, e.boshi + 0.3, size * 1.05 + (e.izoh ? p.W * 0.07 : 0));
	return (
		<AbsoluteFill style={{alignItems: 'center', paddingTop: tepa, opacity: c}}>
			<div style={{fontFamily: 'MontB', fontSize: size, lineHeight: 1, color: p.uslub.urgu, transform: `scale(${0.6 + 0.4 * k})`,
				textShadow: `${kontur(size * 0.03)}, 0 0 ${size * 0.35 * (1 - x * 0.5)}px ${p.uslub.urgu}`, fontVariantNumeric: 'tabular-nums'}}>{matn}</div>
			{e.izoh ? <div style={{fontFamily: 'MontB', fontSize: p.W * 0.055, color: '#fff', textTransform: 'uppercase', marginTop: p.W * 0.01,
				opacity: k, textShadow: kontur(3)}}>{e.izoh}</div> : null}
		</AbsoluteFill>
	);
};

// $500 (qizil, chiziladi) → $2 000 (yashil, sakraydi)
const Solishtir: React.FC<{e: Extract<Element, {tur: 'solishtir'}>; p: ReelProps}> = ({e, p}) => {
	const f = useCurrentFrame();
	const {fps} = useVideoConfig();
	const {k, c} = useKirish(e.boshi, e.oxiri);
	const d = (e.oxiri - e.boshi) * fps;
	const chiz = interpolate(f - bosh(e, fps), [d * 0.25, d * 0.38], [0, 1], clamp);
	const k2 = spring({frame: f - bosh(e, fps) - Math.round(d * 0.42), fps, config: {damping: 8, stiffness: 180}});
	// ikki kartochka + strelka xavfsiz kenglikka sig'sin (har biri bitta qatorda)
	const kenglik = p.W - p.xz.left - p.xz.right - p.W * 0.06;
	const S = Math.min(p.W * 0.12, kenglik / ((e.chap.length + e.ong.length) * 0.68 + 2.4));
	const tepa = matnTepa(p, e.boshi + 0.3, S * 1.9);
	const kart = (matn: string, izoh: string | undefined, rang: string, sk: number, chizik: number) => (
		<div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', transform: `scale(${sk})`}}>
			{izoh ? <div style={{fontFamily: 'MontX', fontSize: S * 0.32, color: '#fff', textShadow: kontur(2), marginBottom: 4, textTransform: 'uppercase'}}>{izoh}</div> : null}
			<div style={{position: 'relative', fontFamily: 'MontB', fontSize: S, color: '#fff', background: rang, borderRadius: S * 0.25, whiteSpace: 'nowrap',
				padding: `${S * 0.08}px ${S * 0.25}px`, boxShadow: '0 10px 30px rgba(0,0,0,.4)'}}>
				{matn}
				{chizik > 0 ? <div style={{position: 'absolute', left: '6%', top: '50%', height: S * 0.1, width: `${88 * chizik}%`, background: '#111',
					transform: 'rotate(-8deg)', borderRadius: 6}} /> : null}
			</div>
		</div>
	);
	return (
		<AbsoluteFill style={{alignItems: 'center', paddingTop: tepa, opacity: c}}>
			<div style={{display: 'flex', alignItems: 'flex-end', gap: S * 0.35}}>
				{kart(e.chap, e.chap_izoh, '#DC2626', k * (1 - 0.15 * chiz), chiz)}
				<div style={{fontFamily: 'MontB', fontSize: S * 0.8, color: '#fff', opacity: k2, textShadow: kontur(3), marginBottom: S * 0.1}}>→</div>
				{kart(e.ong, e.ong_izoh, '#16A34A', k2 * 1.08, 0)}
			</div>
		</AbsoluteFill>
	);
};

// ✓ ro'yxat (kurs mazmuni) — shisha kartochka, yuz ostida; bu paytda subtitr yashirinadi
const Royxat: React.FC<{e: Extract<Element, {tur: 'royxat'}>; p: ReelProps}> = ({e, p}) => {
	const f = useCurrentFrame();
	const {fps} = useVideoConfig();
	const {k, c} = useKirish(e.boshi, e.oxiri);
	const fs = p.W * 0.052;
	const qH = fs * 1.9;
	const H = qH * e.qatorlar.length * 1.25 + (e.sarlavha ? fs * 1.6 : 0) + fs * 1.4;
	const yz = yuzAt(p, e.boshi + 0.3);
	const top = yz ? Math.min((yz.y + yz.h * 1.1) * p.H, p.H - p.xz.bottom - H - p.H * 0.02) : p.H * 0.5;
	const qadam = Math.max(4, Math.round(((e.oxiri - e.boshi) * fps * 0.6) / e.qatorlar.length));
	return (
		<div style={{position: 'absolute', left: p.xz.left + p.W * 0.04, right: p.xz.right + p.W * 0.04, top, opacity: c, ...oyna,
			borderRadius: fs * 0.7, padding: `${fs * 0.7}px ${fs * 0.9}px`, transform: `translateY(${(1 - k) * 60}px)`}}>
			{e.sarlavha ? <div style={{fontFamily: 'MontB', fontSize: fs * 0.95, color: p.uslub.urgu, marginBottom: fs * 0.5, textTransform: 'uppercase'}}>{e.sarlavha}</div> : null}
			{e.qatorlar.map((q, i) => {
				const kk = spring({frame: f - bosh(e, fps) - 4 - i * qadam, fps, config: {damping: 12}});
				return (
					<div key={i} style={{display: 'flex', alignItems: 'center', gap: fs * 0.5, minHeight: qH, padding: `${fs * 0.15}px 0`, opacity: kk, transform: `translateX(${(1 - kk) * -40}px)`}}>
						<svg width={fs * 1.2} height={fs * 1.2} viewBox="0 0 24 24" style={{flexShrink: 0, transform: `scale(${kk})`}}>
							<circle cx="12" cy="12" r="12" fill="#16A34A" /><path d="M6.5 12.5l3.5 3.5 7.5-8" stroke="#fff" strokeWidth="2.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
						</svg>
						<span style={{fontFamily: 'MontX', fontSize: fs, lineHeight: 1.15, color: '#fff'}}>{q}</span>
					</div>
				);
			})}
		</div>
	);
};

// Markazda porlovchi tugma bosiladi → chiplar atrofga uchib chiqadi ("1 TUGMA" / "AI")
const Generator: React.FC<{e: Extract<Element, {tur: 'generator'}>; p: ReelProps}> = ({e, p}) => {
	const f = useCurrentFrame();
	const {fps} = useVideoConfig();
	const {k, c} = useKirish(e.boshi, e.oxiri);
	const bosT = Math.round((e.bosish ?? e.boshi + 0.6) * fps);
	const bos = interpolate(f, [bosT - 3, bosT, bosT + 5], [1, 0.84, 1], clamp);
	const halqa = interpolate(f, [bosT, bosT + 18], [0, 1], clamp);
	const cx = p.W / 2, cy = p.xz.top + (p.H - p.xz.top - p.xz.bottom) * 0.42;
	const R = p.W * 0.15;
	const n = e.chiqish.length;
	return (
		<AbsoluteFill style={{opacity: c}}>
			{e.chiqish.map((q, i) => {
				const ang = (i / n) * Math.PI * 2 - Math.PI / 2 + Math.PI / n;
				const kk = spring({frame: f - bosT - 4 - i * 3, fps, config: {damping: 10, stiffness: 150}});
				const dist = R * 1.95 * kk;
				const x = cx + Math.cos(ang) * dist, y = cy + Math.sin(ang) * dist * 1.1;
				return (
					<React.Fragment key={i}>
						<svg width={p.W} height={p.H} style={{position: 'absolute', left: 0, top: 0, opacity: 0.5 * kk}}>
							<line x1={cx} y1={cy} x2={x} y2={y} stroke={p.uslub.urgu} strokeWidth={3} strokeDasharray="8 8" />
						</svg>
						<div style={{position: 'absolute', left: x, top: y, transform: `translate(-50%,-50%) scale(${kk})`, fontFamily: 'MontB',
							fontSize: p.W * 0.048, color: '#fff', padding: `${p.W * 0.014}px ${p.W * 0.03}px`, borderRadius: p.W * 0.03, whiteSpace: 'nowrap', ...oyna}}>{q}</div>
					</React.Fragment>
				);
			})}
			<div style={{position: 'absolute', left: cx - R * (1 + halqa * 1.2), top: cy - R * (1 + halqa * 1.2), width: R * 2 * (1 + halqa * 1.2),
				height: R * 2 * (1 + halqa * 1.2), borderRadius: '50%', border: `4px solid ${p.uslub.urgu}`, opacity: (1 - halqa) * (halqa > 0 ? 1 : 0)}} />
			<div style={{position: 'absolute', left: cx - R, top: cy - R, width: R * 2, height: R * 2, borderRadius: '50%', background: p.uslub.urgu,
				display: 'flex', alignItems: 'center', justifyContent: 'center', transform: `scale(${k * bos})`,
				boxShadow: `0 0 ${R * 0.8}px ${p.uslub.urgu}, 0 20px 50px rgba(0,0,0,.5)`}}>
				<span style={{fontFamily: 'MontB', fontSize: sigdir(e.markaz, R * 0.55, R * 1.7), color: p.uslub.urgu_matn, textAlign: 'center', lineHeight: 1}}>{e.markaz}</span>
			</div>
		</AbsoluteFill>
	);
};

// Yakuniy CTA kartochka: dastur nomi + izoh + pulsatsiya qiluvchi tugma (pastdagi reklama tugmasiga ishora)
const Cta: React.FC<{e: Extract<Element, {tur: 'cta'}>; p: ReelProps}> = ({e, p}) => {
	const f = useCurrentFrame();
	const {fps} = useVideoConfig();
	const {k, c} = useKirish(e.boshi, e.oxiri);
	const puls = 1 + 0.05 * Math.sin((f / fps) * Math.PI * 2 * 1.6);
	const strel = Math.sin((f / fps) * Math.PI * 2 * 1.6) * 8;
	const fs = p.W * 0.06;
	const H = fs * 5.2;
	return (
		<div style={{position: 'absolute', left: p.xz.left + p.W * 0.03, right: p.xz.right + p.W * 0.03, top: p.H - p.xz.bottom - H - p.H * 0.01,
			opacity: c, ...oyna, borderRadius: fs * 0.6, padding: `${fs * 0.5}px ${fs * 0.6}px`, textAlign: 'center',
			transform: `translateY(${(1 - k) * 120}px)`}}>
			<div style={{fontFamily: 'MontB', fontSize: sigdir(e.sarlavha, fs * 1.25, p.W * 0.7), color: p.uslub.urgu, lineHeight: 1.05}}>{e.sarlavha}</div>
			{e.izoh ? <div style={{fontFamily: 'MontX', fontSize: fs * 0.6, color: '#fff', marginTop: fs * 0.2}}>{e.izoh}</div> : null}
			<div style={{display: 'inline-block', marginTop: fs * 0.4, fontFamily: 'MontB', fontSize: fs * 0.75, color: p.uslub.urgu_matn,
				background: p.uslub.urgu, borderRadius: fs, padding: `${fs * 0.25}px ${fs * 0.8}px`, transform: `scale(${puls})`,
				boxShadow: `0 0 ${fs * 0.6}px ${p.uslub.urgu}`}}>
				{e.tugma} <span style={{display: 'inline-block', transform: `translateY(${strel}px)`}}>👇</span>
			</div>
		</div>
	);
};

// Ibora yozuvi (Umida uslubi): katta qalin ibora + kichik izoh, to'q sariq plashkada, ko'krak balandligida
const Yozuv: React.FC<{e: Extract<Element, {tur: 'yozuv'}>; p: ReelProps}> = ({e, p}) => {
	const f = useCurrentFrame();
	const {fps} = useVideoConfig();
	const {k, c} = useKirish(e.boshi, e.oxiri);
	const fon = e.fon ?? 'urgu';
	const kenglik = p.W - p.xz.left - p.xz.right - p.W * 0.12;
	const {size, qator} = qatorlab(e.matn, p.W * 0.072, kenglik);
	const ks = p.W * 0.036;
	const H = size * 1.12 * qator + (e.kichik ? ks * 1.5 : 0) + p.W * 0.04;
	const yz = yuzAt(p, e.boshi + 0.2);
	const joy = e.joy ?? 'orta';
	let top = joy === 'tepa' ? matnTepa(p, e.boshi + 0.2, H)
		: joy === 'past' ? p.H - p.xz.bottom - H - p.H * 0.02
		: Math.max(yz ? (yz.y + yz.h * 1.35) * p.H : p.H * 0.55, p.H * 0.52);
	top = Math.min(top, p.H - p.xz.bottom - H - p.H * 0.01);
	const ochil = interpolate(f - bosh(e, fps), [0, 7], [0, 100], {...clamp, easing: Easing.out(Easing.cubic)});
	if (fon === 'sut') return <SutPlashka e={e} p={p} top={top} kenglik={kenglik} />;
	const bg = fon === 'urgu' ? p.uslub.urgu : fon === 'qora' ? 'rgba(30,30,30,.82)' : fon === 'oq' ? '#FFFFFF' : 'transparent';
	const matnRang = fon === 'oq' ? '#1F1F1F' : '#fff';
	const kichikRang = fon === 'oq' ? p.uslub.urgu : '#fff';
	return (
		<div style={{position: 'absolute', left: 0, right: 0, top, display: 'flex', justifyContent: 'center', opacity: c}}>
			<div style={{position: 'relative', background: bg, borderRadius: p.W * 0.012, padding: fon === 'yoq' ? 0 : `${p.W * 0.015}px ${p.W * 0.035}px`, textAlign: 'center',
				transform: `translateY(${(1 - k) * 30}px)`, clipPath: `inset(0 ${100 - ochil}% 0 0)`,
				boxShadow: fon === 'yoq' ? 'none' : '0 10px 30px rgba(0,0,0,.25)'}}>
				<div style={{fontFamily: 'MontB', fontSize: size, lineHeight: 1.05, color: matnRang, textTransform: 'uppercase',
					whiteSpace: qator > 1 ? 'normal' : 'nowrap', maxWidth: kenglik,
					textShadow: fon === 'yoq' ? kontur(size * 0.03) : 'none'}}>{e.matn}</div>
				{e.kichik ? <div style={{fontFamily: 'MontX', fontSize: ks, color: kichikRang, opacity: 0.95, marginTop: ks * 0.2,
					textShadow: fon === 'yoq' ? kontur(2) : 'none'}}>{e.kichik}</div> : null}
				{fon !== 'yoq' ? (
					<div style={{position: 'absolute', inset: 0, borderRadius: p.W * 0.012, overflow: 'hidden', pointerEvents: 'none'}}>
						<div style={{position: 'absolute', top: '-50%', bottom: '-50%', width: '35%', mixBlendMode: 'overlay',
							background: 'linear-gradient(100deg, transparent, rgba(255,255,255,.85), transparent)',
							left: `${interpolate(f - bosh(e, fps), [8, 26], [-40, 130], clamp)}%`, transform: 'rotate(12deg)'}} />
					</div>
				) : null}
			</div>
		</div>
	);
};

// Namuna (ko'k plashka) uslubi, foydalanuvchi rangida: sutli fon, to'q jigarrang matn; kichik qator tepada,
// emoji matn yonida — plashka ICHIDA (videoning tepasiga alohida chiqmaydi)
const SUT = '#F6EFE4', JIGAR = '#4A2C1C';
const SutPlashka: React.FC<{e: Extract<Element, {tur: 'yozuv'}>; p: ReelProps; top: number; kenglik: number}> = ({e, p, top, kenglik}) => {
	const f = useCurrentFrame();
	const {fps} = useVideoConfig();
	const {k, c} = useKirish(e.boshi, e.oxiri);
	const em = e.emoji ? 1.25 : 0; // emoji eni (belgi hisobida)
	const size = Math.min(p.W * 0.075, kenglik / ((e.matn.length + em) * 0.7));
	// uzun kichik qator (24+ belgi) ikki qatorga, o'rtaga yaqin bo'shliqdan bo'linadi
	const kq = (() => {
		const k0 = e.kichik ?? '';
		if (k0.length <= 24) return [k0];
		const ix = [...k0.matchAll(/ /g)].map((m) => m.index!).sort((x, y) => Math.abs(x - k0.length / 2) - Math.abs(y - k0.length / 2))[0];
		return ix ? [k0.slice(0, ix), k0.slice(ix + 1)] : [k0];
	})();
	const ks = Math.min(p.W * 0.042, kenglik / (Math.max(...kq.map((q) => q.length)) * 0.66));
	return (
		<div style={{position: 'absolute', left: 0, right: 0, top, display: 'flex', justifyContent: 'center', opacity: c * Math.min(1, k * 1.6)}}>
			<div style={{position: 'relative', background: SUT, borderRadius: p.W * 0.03, border: `${p.W * 0.004}px solid rgba(255,255,255,.9)`,
				padding: `${p.W * 0.018}px ${p.W * 0.04}px ${p.W * 0.022}px`, textAlign: 'center', transform: `scale(${0.82 + 0.18 * k})`,
				boxShadow: '0 14px 40px rgba(0,0,0,.28)', overflow: 'hidden'}}>
				{e.kichik ? <div style={{fontFamily: 'MontB', fontSize: ks, lineHeight: 1.1, color: JIGAR, opacity: 0.85, textTransform: 'uppercase',
					whiteSpace: 'nowrap'}}>{kq.map((q, i) => <div key={i}>{q}</div>)}</div> : null}
				<div style={{fontFamily: 'MontB', fontSize: size, lineHeight: 1.08, color: JIGAR, textTransform: 'uppercase', whiteSpace: 'nowrap',
					display: 'flex', alignItems: 'center', justifyContent: 'center', gap: size * 0.22}}>
					<span>{e.matn}</span>
					{e.emoji ? <span style={{fontFamily: '"Apple Color Emoji"', fontSize: size * 0.95, lineHeight: 1, display: 'inline-block',
						transform: `scale(${spring({frame: f - bosh(e, fps) - 6, fps, config: {damping: 9, stiffness: 200}})})`}}>{e.emoji}</span> : null}
				</div>
				<div style={{position: 'absolute', top: '-50%', bottom: '-50%', width: '30%', pointerEvents: 'none',
					background: 'linear-gradient(100deg, transparent, rgba(255,255,255,.75), transparent)',
					left: `${interpolate(f - bosh(e, fps), [6, 24], [-40, 130], clamp)}%`, transform: 'rotate(12deg)'}} />
			</div>
		</div>
	);
};

// Namunadagi kartochka: oq yumaloq kartochka 3D aylanib ko'krak oldiga chiqadi; ichida stories ko'rinishi (N qator) + yozuv
const Kartochka: React.FC<{e: Extract<Element, {tur: 'kartochka'}>; p: ReelProps}> = ({e, p}) => {
	const f = useCurrentFrame();
	const {fps} = useVideoConfig();
	const k = spring({frame: f - bosh(e, fps), fps, config: {damping: 13, stiffness: 120, mass: 0.8}});
	const ch = interpolate(f, [e.oxiri * fps - 8, e.oxiri * fps], [0, 1], {...clamp, easing: Easing.in(Easing.cubic)});
	const w = p.W * 0.46;
	const size = Math.min(p.W * 0.05, (w * 0.9) / (e.matn.length * 0.58));
	const n = e.qatorlar ?? 2;
	return (
		<AbsoluteFill style={{perspective: p.W * 1.6}}>
			<div style={{position: 'absolute', left: (p.W - w) / 2, top: p.H * 0.56, width: w, background: '#fff', borderRadius: w * 0.09,
				padding: w * 0.06, boxShadow: '0 25px 60px rgba(0,0,0,.35)', opacity: Math.min(1, k * 2) * (1 - ch),
				transform: `rotateY(${(1 - k) * -75 + ch * 35}deg) rotateZ(${(1 - k) * -10 + ch * 6}deg) rotateX(${ch * 25}deg) scale(${0.55 + 0.45 * k - 0.3 * ch})`}}>
				<div style={{height: w * 0.62, borderRadius: w * 0.07, overflow: 'hidden', position: 'relative',
					background: 'linear-gradient(160deg, #E9D8C4, #C9A887)', display: 'flex', flexDirection: 'column', justifyContent: 'center',
					alignItems: 'center', gap: w * 0.045}}>
					{e.rasm ? <Img src={staticFile(e.rasm)} style={{position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover'}} />
						: Array.from({length: n}).map((_, i) => {
							const q = interpolate(f - bosh(e, fps), [10 + i * 5, 18 + i * 5], [0, 1], {...clamp, easing: Easing.out(Easing.cubic)});
							return <div key={i} style={{height: w * 0.075, width: `${(i % 2 ? 52 : 70) * q}%`, borderRadius: w * 0.04, background: '#fff',
								boxShadow: '0 2px 6px rgba(0,0,0,.12)'}} />;
						})}
				</div>
				<div style={{fontFamily: 'MontB', fontSize: size, color: JIGAR, textAlign: 'center', marginTop: w * 0.05, whiteSpace: 'nowrap'}}>{e.matn}</div>
			</div>
		</AbsoluteFill>
	);
};

// Instagram obuna paneli: @handle + Follow → kursor bosadi → Following (namuna yakunidagidek)
const Obuna: React.FC<{e: Extract<Element, {tur: 'obuna'}>; p: ReelProps}> = ({e, p}) => {
	const f = useCurrentFrame();
	const {fps} = useVideoConfig();
	const {k, c} = useKirish(e.boshi, e.oxiri);
	const bos = e.bosish ?? e.boshi + 1.1;
	const tb = f / fps - bos; // bosishgacha manfiy
	const w = p.W * 0.74, h = p.W * 0.13;
	const bx = w * 0.7, bw = w * 0.25; // tugma joyi (panel ichida)
	const kur = interpolate(tb, [-0.8, -0.1], [0, 1], {...clamp, easing: Easing.inOut(Easing.cubic)});
	const bosildi = tb >= 0;
	const bosish = interpolate(tb, [-0.08, 0, 0.12], [1, 0.88, 1], clamp);
	const left = (p.W - w) / 2, top = p.H * 0.6;
	return (
		<AbsoluteFill style={{opacity: c}}>
			<div style={{position: 'absolute', left, top, width: w, height: h, background: '#fff', borderRadius: h * 0.22,
				boxShadow: '0 18px 45px rgba(0,0,0,.3)', display: 'flex', alignItems: 'center', padding: `0 ${h * 0.22}px`, gap: h * 0.2,
				transform: `translateY(${(1 - k) * 40}px) scale(${0.9 + 0.1 * k})`, opacity: Math.min(1, k * 1.8)}}>
				<div style={{width: h * 0.66, height: h * 0.66, borderRadius: '50%', overflow: 'hidden', flexShrink: 0,
					border: '2px solid #eee', background: '#ddd'}}>
					{e.avatar ? <Img src={staticFile(e.avatar)} style={{width: '100%', height: '100%', objectFit: 'cover'}} /> : null}
				</div>
				<div style={{fontFamily: 'MontB', fontSize: h * 0.27, color: '#111', flex: 1, whiteSpace: 'nowrap'}}>{e.handle}</div>
				<div style={{position: 'absolute', left: bx, width: bw, height: h * 0.5, borderRadius: h * 0.12, display: 'flex',
					alignItems: 'center', justifyContent: 'center', fontFamily: 'MontX', fontSize: h * 0.2, transform: `scale(${bosish})`,
					background: bosildi ? 'linear-gradient(90deg, #833AB4, #E1306C, #F77737)' : '#EFEFEF', color: bosildi ? '#fff' : '#9a9a9a'}}>
					{bosildi ? 'Following' : 'Follow'}
				</div>
			</div>
			{/* kursor: pastdan o'ngdan tugmaga keladi */}
			<svg width={p.W * 0.06} height={p.W * 0.06} viewBox="0 0 24 24" style={{position: 'absolute',
				left: left + bx + bw * 0.55 + (1 - kur) * p.W * 0.18, top: top + h * 0.5 + (1 - kur) * p.W * 0.2,
				opacity: interpolate(tb, [-0.9, -0.7, 0.6, 0.8], [0, 1, 1, 0], clamp), transform: `scale(${bosish})`,
				filter: 'drop-shadow(0 2px 3px rgba(0,0,0,.4))'}}>
				<path d="M4 2 L4 19 L8.5 15 L11.5 22 L14.5 20.7 L11.6 14 L18 14 Z" fill="#fff" stroke="#111" strokeWidth="1.4" strokeLinejoin="round" />
			</svg>
		</AbsoluteFill>
	);
};

// Oq ekranli tanishtiruv: video to'q sariq ramkali kartochka ichida + tepada izoh, pastda @handle
const Tanishtiruv: React.FC<{e: Extract<Element, {tur: 'tanishtiruv'}>; p: ReelProps}> = ({e, p}) => {
	const f = useCurrentFrame();
	const {fps} = useVideoConfig();
	const {c} = useKirish(e.boshi, e.oxiri);
	const x = interpolate(f - bosh(e, fps), [0, 9], [0, 1], {...clamp, easing: Easing.out(Easing.cubic)});
	const cw = p.W * 0.6, ch = cw * 1.22;
	const cx = p.W / 2, cy = p.H * 0.47;
	const w = p.W + (cw - p.W) * x, h = p.H + (ch - p.H) * x;
	return (
		<AbsoluteFill style={{opacity: c}}>
			<AbsoluteFill style={{background: '#FFFFFF', opacity: x}} />
			{p.fon_grid ? <Img src={staticFile(p.fon_grid)} style={{position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.35 * x}} /> : null}
			<div style={{position: 'absolute', left: cx - w / 2, top: cy - h / 2, width: w, height: h, borderRadius: p.W * 0.05 * x,
				overflow: 'hidden', border: `${p.W * 0.012 * x}px solid ${p.uslub.urgu}`, boxShadow: `0 20px 50px rgba(0,0,0,${0.25 * x})`}}>
				<OffthreadVideo src={staticFile(p.video)} muted style={{width: '100%', height: '100%', objectFit: 'cover'}} />
			</div>
			<div style={{position: 'absolute', left: 0, right: 0, top: cy - ch / 2 - p.W * 0.16, textAlign: 'center', opacity: x,
				transform: `translateY(${(1 - x) * -20}px)`, fontFamily: 'MontX', fontSize: p.W * 0.052, lineHeight: 1.05, color: p.uslub.urgu}}>
				{e.tepa.split('|').map((q, i) => <div key={i}>{q}</div>)}
			</div>
			<div style={{position: 'absolute', left: 0, right: 0, top: cy + ch / 2 - p.W * 0.03, display: 'flex', justifyContent: 'center', opacity: x,
				transform: `translateY(${(1 - x) * 20}px)`}}>
				<span style={{background: p.uslub.urgu, color: '#fff', fontFamily: 'MontX', fontSize: p.W * 0.042, borderRadius: p.W * 0.02,
					padding: `${p.W * 0.012}px ${p.W * 0.03}px`}}>◎ {e.pastki}</span>
			</div>
		</AbsoluteFill>
	);
};

// Kichik hisoblagichlar tepada: "+100.000 qamrovlar   +1000 obunachi"
const Hisoblar: React.FC<{e: Extract<Element, {tur: 'hisoblar'}>; p: ReelProps}> = ({e, p}) => {
	const f = useCurrentFrame();
	const {fps} = useVideoConfig();
	const {c} = useKirish(e.boshi, e.oxiri);
	const n = e.qatorlar.length;
	const top = matnTepa(p, e.boshi + 0.2, p.W * 0.12);
	return (
		<div style={{position: 'absolute', left: p.xz.left + p.W * 0.04, right: p.xz.right + p.W * 0.04, top, display: 'flex',
			justifyContent: n > 1 ? 'space-between' : 'center', opacity: c}}>
			{e.qatorlar.map((q, i) => {
				const x = interpolate(f - bosh(e, fps) - i * 5, [0, fps * 0.8], [0, 1], {...clamp, easing: Easing.out(Easing.cubic)});
				const k = spring({frame: f - bosh(e, fps) - i * 5, fps, config: {damping: 12}});
				const son = Math.round(q.qiymat * x).toLocaleString('ru-RU').replace(/\u00a0/g, '.').replace(/ /g, '.');
				return (
					<div key={i} style={{textAlign: 'center', transform: `scale(${k})`}}>
						<div style={{fontFamily: 'MontB', fontSize: p.W * 0.068, color: p.uslub.urgu, lineHeight: 1, textShadow: kontur(2.5, 'rgba(0,0,0,.55)')}}>
							{q.old ?? '+'}{son}{x >= 1 ? q.qosh ?? '' : ''}</div>
						<div style={{fontFamily: 'MontX', fontSize: p.W * 0.034, color: '#fff', textShadow: kontur(2)}}>{q.izoh}</div>
					</div>
				);
			})}
		</div>
	);
};

// Kamera ramkasi (oq-qora hook uchun): burchak qavslari + REC
const Ramka: React.FC<{e: Extract<Element, {tur: 'oq_qora'}>; p: ReelProps}> = ({e, p}) => {
	const f = useCurrentFrame();
	const {fps} = useVideoConfig();
	const {c} = useKirish(e.boshi, e.oxiri);
	const L = p.W * 0.09, q = p.W * 0.008;
	const m = {top: p.xz.top * 0.6, bottom: p.xz.bottom * 0.75, left: p.W * 0.06, right: p.W * 0.06};
	const burchak = (st: React.CSSProperties) => <div style={{position: 'absolute', width: L, height: L, borderColor: '#fff', borderStyle: 'solid', borderWidth: 0, ...st}} />;
	const rec = Math.floor((f / fps) * 2) % 2 === 0;
	return (
		<AbsoluteFill style={{opacity: c * 0.9}}>
			{burchak({top: m.top, left: m.left, borderTopWidth: q, borderLeftWidth: q})}
			{burchak({top: m.top, right: m.right, borderTopWidth: q, borderRightWidth: q})}
			{burchak({bottom: m.bottom, left: m.left, borderBottomWidth: q, borderLeftWidth: q})}
			{burchak({bottom: m.bottom, right: m.right, borderBottomWidth: q, borderRightWidth: q})}
			<div style={{position: 'absolute', top: m.top + L * 0.35, left: m.left + L * 0.35, display: 'flex', alignItems: 'center', gap: 8,
				fontFamily: 'MontX', fontSize: p.W * 0.032, color: '#fff'}}>
				<div style={{width: p.W * 0.022, height: p.W * 0.022, borderRadius: '50%', background: '#EF4444', opacity: rec ? 1 : 0.25}} />REC
			</div>
		</AbsoluteFill>
	);
};

export const Reel: React.FC<ReelProps> = (p) => {
	shriftYukla();
	const f = useCurrentFrame();
	const {fps} = useVideoConfig();
	const t = f / fps;
	const els = p.elementlar;
	return (
		<AbsoluteFill style={{background: '#000'}}>
			<Asosiy p={p} t={t} />
			{/* odam ORQASIDAGI qatlam: nur, ulkan matn, egri matn → ustidan odam qatlami */}
			{els.map((e, i) => (e.tur === 'egri_matn' && faol(t, e) ? <EgriMatn key={`n${i}`} e={e} p={p} qism="nur" /> : null))}
			{els.map((e, i) => (e.tur === 'orqa_matn' && faol(t, e) ? <OrqaMatn key={`o${i}`} e={e} p={p} /> : null))}
			{p.odam && els.some((e) => (e.tur === 'orqa_matn' || (e.tur === 'egri_matn' && e.nur !== false)) && faol(t, e))
				? <Asosiy p={p} t={t} odam /> : null}
			{els.map((e, i) => (e.tur === 'egri_matn' && faol(t, e) ? <EgriMatn key={`e${i}`} e={e} p={p} qism="matn" /> : null))}
			{els.map((e, i) => (e.tur === 'broll' && faol(t, e) ? <Broll key={`b${i}`} e={e} p={p} /> : null))}
			{els.some((e) => e.tur === 'vinyetka' && faol(t, e)) ? (
				<AbsoluteFill style={{background: 'radial-gradient(ellipse at 50% 42%, rgba(0,0,0,0) 45%, rgba(0,0,0,.65) 100%)'}} />
			) : null}
			{p.hook && faol(t, p.hook) ? <Hook h={p.hook} p={p} /> : null}
			{els.map((e, i) => (e.tur === 'katta_soz' && faol(t, e) ? <KattaSoz key={`k${i}`} e={e} p={p} /> : null))}
			{els.map((e, i) => ((e.tur === 'stiker' || e.tur === 'logo') && faol(t, e) ? <Stiker key={`s${i}`} e={e} p={p} /> : null))}
			{els.map((e, i) => (e.tur === 'avatarlar' && faol(t, e) ? <Avatarlar key={`a${i}`} e={e} p={p} /> : null))}
			{els.map((e, i) => (e.tur === 'pufak' && faol(t, e) ? <Pufak key={`p${i}`} e={e} p={p} /> : null))}
			{els.map((e, i) => (e.tur === 'raqamlar' && faol(t, e) ? <Raqamlar key={`r${i}`} e={e} p={p} /> : null))}
			{els.map((e, i) => (e.tur === 'telefon' && faol(t, e) ? <Telefon key={`t${i}`} e={e} p={p} /> : null))}
			{els.map((e, i) => (e.tur === 'raqam' && faol(t, e) ? <Raqam key={`q${i}`} e={e} p={p} /> : null))}
			{els.map((e, i) => (e.tur === 'solishtir' && faol(t, e) ? <Solishtir key={`c${i}`} e={e} p={p} /> : null))}
			{els.map((e, i) => (e.tur === 'royxat' && faol(t, e) ? <Royxat key={`l${i}`} e={e} p={p} /> : null))}
			{els.map((e, i) => (e.tur === 'generator' && faol(t, e) ? <Generator key={`g${i}`} e={e} p={p} /> : null))}
			{els.map((e, i) => (e.tur === 'cta' && faol(t, e) ? <Cta key={`y${i}`} e={e} p={p} /> : null))}
			{els.map((e, i) => (e.tur === 'oq_qora' && e.ramka !== false && faol(t, e) ? <Ramka key={`m${i}`} e={e} p={p} /> : null))}
			{els.map((e, i) => (e.tur === 'hisoblar' && faol(t, e) ? <Hisoblar key={`h${i}`} e={e} p={p} /> : null))}
			{els.map((e, i) => (e.tur === 'yozuv' && faol(t, e) ? <Yozuv key={`w${i}`} e={e} p={p} /> : null))}
			{els.map((e, i) => (e.tur === 'kartochka' && faol(t, e) ? <Kartochka key={`kc${i}`} e={e} p={p} /> : null))}
			{els.map((e, i) => (e.tur === 'obuna' && faol(t, e) ? <Obuna key={`ob${i}`} e={e} p={p} /> : null))}
			{els.map((e, i) => (e.tur === 'tanishtiruv' && faol(t, e) ? <Tanishtiruv key={`i${i}`} e={e} p={p} /> : null))}
			{els.map((e, i) => (e.tur === 'otish' && faol(t, e) ? <Otish key={`x${i}`} e={e} p={p} /> : null))}
			{(p.ovozlar ?? []).map((o, i) => (
				<Sequence key={`o${i}`} from={Math.max(0, Math.round(o.boshi * fps))}>
					<Audio src={staticFile(o.fayl)} volume={o.balandlik ?? 0.5} />
				</Sequence>
			))}
			<Subtitr p={p} t={t} />
		</AbsoluteFill>
	);
};
