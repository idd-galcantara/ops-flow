/// <reference types="vite/client" />

import type { KubeConfigStatus } from './types';
import type { Preset } from './presets';

interface DesktopSelectionResult {
	cancelled: boolean;
	status?: KubeConfigStatus;
	error?: string;
}

declare global {
	interface Window {
		opsFlowDesktop?: {
			isDesktop: boolean;
			platform: string;
			selectKubeconfig: () => Promise<DesktopSelectionResult>;
			loadPresets: () => Promise<Preset[]>;
			savePresets: (presets: Preset[]) => Promise<void>;
		};
	}
}
