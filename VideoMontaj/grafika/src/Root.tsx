import React from 'react';
import {CalculateMetadataFunction, Composition} from 'remotion';
import {Sarlavha} from './Sarlavha';
import {Raqam} from './Raqam';
import {Ikonka} from './Ikonka';
import {Stiker} from './Stiker';
import {Rolik, RolikProps} from './Rolik';
import {Reel, ReelProps} from './Reel';
import joriySahna from './joriy-sahna.json';

export type Props = {
	matn: string;
	raqam?: string;
	emoji?: string;
	matnRang?: string;
	xz?: {top: number; bottom: number; left: number; right: number};
	rang?: string;
	W: number;
	H: number;
	fps: number;
	davom: number;
};

const meta: CalculateMetadataFunction<Props> = ({props}) => ({
	width: props.W,
	height: props.H,
	fps: props.fps,
	durationInFrames: Math.max(1, Math.round(props.davom * props.fps)),
});

const namuna: Props = {matn: 'Progrev — trafik va sotuv orasidagi ko‘prik', W: 1080, H: 1920, fps: 30, davom: 3};

export const Root: React.FC = () => (
	<>
		<Composition id="Sarlavha" component={Sarlavha} durationInFrames={90} fps={30} width={1080} height={1920}
			defaultProps={namuna} calculateMetadata={meta} />
		<Composition id="Raqam" component={Raqam} durationInFrames={90} fps={30} width={1080} height={1920}
			defaultProps={{...namuna, matn: 'sotuv bir oyda', raqam: '360 mln'}} calculateMetadata={meta} />
		<Composition id="Stiker" component={Stiker} durationInFrames={45} fps={30} width={400} height={400}
			defaultProps={{...namuna, emoji: '🔥', W: 400, H: 400, davom: 1.5}} calculateMetadata={meta} />
		<Composition id="Rolik" component={Rolik} durationInFrames={90} fps={30} width={1080} height={1920}
			defaultProps={{kadrlar: [{sarlavha: 'Muddat', matn: 'Ertagacha hujjat *yuborishingiz* kerak', boshi: 0, oxiri: 3}],
				uslub: {urgu: '#FFD400', urgu_matn: '#111', fon: '#0B1220', siyoh: '#fff'}, xz: {top: 250, bottom: 450, left: 60, right: 120},
				W: 1080, H: 1920, fps: 30, davom: 3} as RolikProps}
			calculateMetadata={({props}) => ({width: props.W, height: props.H, fps: props.fps, durationInFrames: Math.max(1, Math.round(props.davom * props.fps))})} />
		<Composition id="Reel" component={Reel} durationInFrames={90} fps={30} width={1080} height={1920}
			defaultProps={joriySahna as unknown as ReelProps}
			calculateMetadata={({props}) => ({width: props.W, height: props.H, fps: props.fps, durationInFrames: Math.max(1, Math.round(props.davom * props.fps))})} />
		<Composition id="Ikonka" component={Ikonka} durationInFrames={1} fps={30} width={1024} height={1024} />
	</>
);
