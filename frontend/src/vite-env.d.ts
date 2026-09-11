/// <reference types="vite/client" />

import type { KubeConfigStatus } from './types';

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
		};
	}
}
