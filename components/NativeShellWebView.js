/**
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */
import React, { useState } from 'react';
import { BackHandler, Platform } from 'react-native';
import { action } from 'mobx';
import { observer } from 'mobx-react';
import Constants from 'expo-constants';
import { activateKeepAwake, deactivateKeepAwake } from 'expo-keep-awake';
import compareVersions from 'compare-versions';

import { useStores } from '../hooks/useStores';
import MediaTypes from '../constants/MediaTypes';
import { getAppName, getSafeDeviceName } from '../utils/Device';
import StaticScriptLoader from '../utils/StaticScriptlLoader';
import { openBrowser } from '../utils/WebBrowser';
import RefreshWebView from './RefreshWebView';

const NativeShellWebView = observer(React.forwardRef(
	function NativeShellWebView(props, ref) {
		const { rootStore } = useStores();
		const [isRefreshing, setIsRefreshing] = useState(false);

		const server = rootStore.serverStore.servers[rootStore.settingStore.activeServer];
		const isPluginSupported = compareVersions.compare(server.info?.Version, '10.7', '>=');

		const injectedJavaScript = `
window.ExpoAppInfo = {
	appName: '${getAppName()}',
	appVersion: '${Constants.nativeAppVersion}',
	deviceId: '${Constants.deviceId}',
	deviceName: '${getSafeDeviceName().replace(/'/g, '\\\'')}'
};

window.ExpoAppSettings = {
	isPluginSupported: ${isPluginSupported},
	isNativeVideoPlayerEnabled: ${rootStore.settingStore.isNativeVideoPlayerEnabled}
};

function postExpoEvent(event, data) {
	window.ReactNativeWebView.postMessage(JSON.stringify({
		event: event,
		data: data
	}));
}

${StaticScriptLoader.scripts.NativeVideoPlayer}

${StaticScriptLoader.scripts.NativeShell}

${StaticScriptLoader.scripts.ExpoRouterShim}

true;
`;

		const onRefresh = () => {
			// Disable pull to refresh when in fullscreen
			if (rootStore.isFullscreen) return;
			setIsRefreshing(true);
			ref.current?.reload();
			setIsRefreshing(false);
		};

		const onMessage = action(({ nativeEvent: state }) => {
			try {
				const { event, data } = JSON.parse(state.data);
				switch (event) {
					case 'AppHost.exit':
						BackHandler.exitApp();
						break;
					case 'enableFullscreen':
						rootStore.isFullscreen = true;
						break;
					case 'disableFullscreen':
						rootStore.isFullscreen = false;
						break;
					case 'openUrl':
						console.log('Opening browser for external url', data.url);
						openBrowser(data.url);
						break;
					case 'updateMediaSession':
						// Keep the screen awake when music is playing
						if (rootStore.settingStore.isScreenLockEnabled) {
							activateKeepAwake();
						}
						break;
					case 'hideMediaSession':
						// When music session stops disable keep awake
						if (rootStore.settingStore.isScreenLockEnabled) {
							deactivateKeepAwake();
						}
						break;
					case 'ExpoVideoPlayer.play':
						rootStore.mediaStore.type = MediaTypes.Video;
						rootStore.mediaStore.uri = data.url;
						rootStore.mediaStore.posterUri = data.backdropUrl;
						rootStore.mediaStore.positionTicks = data.playerStartPositionTicks;
						console.debug('PLAY VIDEO =>', Object.keys(data), data.title, data.playerStartPositionTicks);
						break;
					case 'console.debug':
						// console.debug('[Browser Console]', data);
						break;
					case 'console.error':
						console.error('[Browser Console]', data);
						break;
					case 'console.info':
						// console.info('[Browser Console]', data);
						break;
					case 'console.log':
						// console.log('[Browser Console]', data);
						break;
					case 'console.warn':
						console.warn('[Browser Console]', data);
						break;
					default:
						console.debug('[HomeScreen.onMessage]', event, data);
				}
			} catch (ex) {
				console.warn('Exception handling message', state.data);
			}
		});

		return (
			<RefreshWebView
				ref={ref}
				// Allow any origin blocking can break various things like book playback
				originWhitelist={['*']}
				source={{ uri: server.urlString }}
				// Inject javascript for NativeShell
				// This method is preferred, but only supported on iOS currently
				injectedJavaScriptBeforeContentLoaded={Platform.OS === 'ios' ? injectedJavaScript : null}
				// Fallback for non-iOS
				injectedJavaScript={Platform.OS !== 'ios' ? injectedJavaScript : null}
				onMessage={onMessage}
				isRefreshing={isRefreshing}
				onRefresh={onRefresh}
				// Pass through additional props
				{...props}
				// Make scrolling feel faster
				decelerationRate='normal'
				// Media playback options to fix video player
				allowsInlineMediaPlayback={true}
				mediaPlaybackRequiresUserAction={false}
				// Use WKWebView on iOS
				useWebKit={true}
			/>
		);
	}
));

export default NativeShellWebView;
