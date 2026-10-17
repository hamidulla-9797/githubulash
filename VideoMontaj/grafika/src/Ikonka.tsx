import React from 'react';
import {AbsoluteFill} from 'remotion';
import {shriftYukla} from './shrift';

// Montaj.app ikonkasi (1024x1024): kinolenta + qaychi chizig'i
export const Ikonka: React.FC = () => {
	shriftYukla();
	return (
		<AbsoluteFill style={{alignItems: 'center', justifyContent: 'center'}}>
			<div style={{
				width: 824, height: 824, borderRadius: 185, overflow: 'hidden', position: 'relative',
				background: 'linear-gradient(145deg, #1877F2 0%, #0A3E9E 100%)',
				boxShadow: 'inset 0 -20px 60px rgba(0,0,0,.25)',
			}}>
				{/* kinolenta */}
				<div style={{position: 'absolute', left: 112, top: 250, width: 600, height: 330, background: '#111', borderRadius: 36, transform: 'rotate(-8deg)'}}>
					{[0, 1, 2, 3, 4, 5, 6].map((i) => (
						<React.Fragment key={i}>
							<div style={{position: 'absolute', left: 28 + i * 80, top: 18, width: 44, height: 30, background: '#fff', borderRadius: 8, opacity: .9}} />
							<div style={{position: 'absolute', left: 28 + i * 80, bottom: 18, width: 44, height: 30, background: '#fff', borderRadius: 8, opacity: .9}} />
						</React.Fragment>
					))}
					<div style={{position: 'absolute', left: 30, top: 70, width: 250, height: 190, background: '#FFD400', borderRadius: 16}} />
					<div style={{position: 'absolute', left: 320, top: 70, width: 250, height: 190, background: '#FFD400', borderRadius: 16}} />
				</div>
				{/* kesish chizig'i */}
				<div style={{position: 'absolute', left: 395, top: 150, width: 0, height: 520, borderLeft: '14px dashed #fff', transform: 'rotate(-8deg)'}} />
				<div style={{position: 'absolute', bottom: 70, width: '100%', textAlign: 'center', fontFamily: 'MontB', fontSize: 96, color: '#fff', letterSpacing: 4}}>
					MONTAJ
				</div>
			</div>
		</AbsoluteFill>
	);
};
