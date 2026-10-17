// Bir marta bundle qilib, bir nechta grafikani ketma-ket chizadi.
// node render.mjs jobs.json   — jobs: [{comp, props, out}]
import {bundle} from '@remotion/bundler';
import {renderMedia, renderStill, selectComposition} from '@remotion/renderer';
import fs from 'node:fs';
import os from 'node:os';

// Jonli holat (Montaj Holati ilovasi o'qiydi): ~/VideoMontaj/holat.json
const HOLAT = path.join(os.homedir(), 'VideoMontaj', 'holat.json');
const holatYoz = (qism) => {
	try {
		const eski = fs.existsSync(HOLAT) ? JSON.parse(fs.readFileSync(HOLAT, 'utf8')) : {};
		fs.writeFileSync(HOLAT, JSON.stringify({...eski, ...qism, vaqt: Date.now() / 1000}));
	} catch (e) { /* holat — ixtiyoriy */ }
};
import path from 'node:path';

// Linux/bulut: Remotion brauzeri yuklanmasa — tayyor Chromium (MONTAJ_BROWSER=/yo'l/chrome)
const brauzer = process.env.MONTAJ_BROWSER ? {browserExecutable: process.env.MONTAJ_BROWSER} : {};
const jobs = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const serveUrl = await bundle({entryPoint: path.resolve('src/index.ts')});
// bundle nusxasi (public/ bilan ~360 MB) vaqtinchalik papkada qolib ketib, diskni to'ldirgan (156 ta = 33 GB) —
// har chiqishda (xato bilan ham) o'chiriladi
process.on('exit', () => { try { fs.rmSync(serveUrl, {recursive: true, force: true}); } catch (e) { /* */ } });
for (const j of jobs) {
	const composition = await selectComposition({...brauzer, serveUrl, id: j.comp, inputProps: j.props, timeoutInMilliseconds: 120000});
	if (j.kadrlar) {
		// tekshiruv uchun still kadrlar: [{frame, out}]
		for (const k of j.kadrlar) {
			await renderStill({...brauzer, serveUrl, composition, inputProps: j.props, frame: k.frame, output: k.out, imageFormat: 'jpeg', jpegQuality: 85, scale: j.scale ?? 1, timeoutInMilliseconds: 120000});
			console.log('ok', path.basename(k.out));
		}
		continue;
	}
	await renderMedia({
		...brauzer, serveUrl, composition, inputProps: j.props, outputLocation: j.out,
		...(j.codec === 'h264'
			? {codec: 'h264', crf: 18, pixelFormat: 'yuv420p', imageFormat: 'jpeg', jpegQuality: 92, audioCodec: 'aac'}
			: {codec: 'prores', proResProfile: '4444', pixelFormat: 'yuva444p10le', imageFormat: 'png'}),
		logLevel: 'error', concurrency: j.concurrency ?? null, timeoutInMilliseconds: 120000,
		onProgress: ({progress}) => {
			const p = Math.round(progress * 100);
			if (p !== globalThis._p) {
				globalThis._p = p;
				holatYoz({bosqich: j.kadrlar ? 'kadrlar' : 'render', foiz: p});
				if (j.progress && p % 10 === 0) console.log(`   render ${p}%`);
			}
		},
	});
	console.log('ok', path.basename(j.out));
}
// Brauzer yopilishida ba'zan qotib qoladi (Session closed) — ish tugagach jarayonni majburan yopamiz
process.exit(0);
