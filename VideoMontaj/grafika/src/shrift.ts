import {continueRender, delayRender, staticFile} from 'remotion';

// Montserrat — o'zbekcha harflar bilan, lokal fayldan (internet shart emas)
let yuklandi = false;
export const shriftYukla = () => {
	if (yuklandi || typeof document === 'undefined') return;
	yuklandi = true;
	const h = delayRender('shrift');
	Promise.all([
		new FontFace('MontX', `url(${staticFile('Montserrat-ExtraBold.ttf')})`).load(),
		new FontFace('MontB', `url(${staticFile('Montserrat-Black.ttf')})`).load(),
	]).then((fs) => {
		fs.forEach((f) => document.fonts.add(f));
		continueRender(h);
	});
};
