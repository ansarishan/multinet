/**
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */
import { useNavigation } from '@react-navigation/native';
import { action } from 'mobx';
import { observer } from 'mobx-react-lite';
import PropTypes from 'prop-types';
import React, { useContext, useState , useEffect} from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Platform, StyleSheet } from 'react-native';
import { Input, ThemeContext, Text } from 'react-native-elements';

import Screens from '../constants/Screens';
import { useStores } from '../hooks/useStores';
import { getIconName } from '../utils/Icons';
import { parseUrl, validateServer } from '../utils/ServerValidator';

const sanitizeHost = (url = '') => url.trim();

const ServerInput = observer(
	// FIXME: eslint fails to parse the propTypes properly here
	function ServerInput({
		onError = () => { /* noop */ }, // eslint-disable-line react/prop-types
		onSuccess = () => { /* noop */ }, // eslint-disable-line react/prop-types
		...props
	}, ref) {
		const [ host, setHost ] = useState('http://etime.pk'); //https://demo.jellyfin.org/  // http://etime.pk
		const [ isValidating, setIsValidating ] = useState(false);
		const [ isValid, setIsValid ] = useState(true);
		const [ validationMessage, setValidationMessage ] = useState('');

		const { rootStore } = useStores();
		const navigation = useNavigation();
		const { t } = useTranslation();
		const { theme } = useContext(ThemeContext);

		const onAddServer = action(async () =>
		
		{
			console.log('add server', host);
			if (!host) {
				setIsValid(false);
				setValidationMessage(t('addServer.validation.empty'));
				onError();
				return;
			}

			setIsValidating(true);
			setIsValid(true);
			setValidationMessage('');

			// Parse the entered url
			let url;
			try {
				url = parseUrl(host);
				console.log('parsed url', url);
			} catch (err) {
				console.info(err);
				setIsValidating(false);
				setIsValid(false);
				setValidationMessage(t('addServer.validation.invalid'));
				onError();
				return;
			}

			// Validate the server is available
			const validation = await validateServer({ url });
			console.log(`Server is ${validation.isValid ? '' : 'not '}valid`);
			if (!validation.isValid) {
				const message = validation.message || 'invalid';
				setIsValidating(false);
				setIsValid(validation.isValid);
				setValidationMessage(t([ `addServer.validation.${message}`, 'addServer.validation.invalid' ]));
				onError();
				return;
			}

			// Save the server details
			rootStore.serverStore.addServer({ url });
			rootStore.settingStore.activeServer = rootStore.serverStore.servers.length - 1;
			// Call the success callback
			onSuccess();

			// Navigate to the main screen
			navigation.replace(
				Screens.MainScreen,
				{
					screen: Screens.HomeTab,
					params: {
						screen: Screens.HomeScreen,
						params: { activeServer: rootStore.settingStore.activeServer }
					}
				}
			);
		});
useEffect(()=>{


	onAddServer().then(()=>{});
},[]);

		return (
			<>
<Text style={styles.inputContainerStyle1}>{isValidating?"Connecting to Multilive Server...":""}</Text>

<Text style={styles.inputContainerStyle}>{isValid ? null : validationMessage +"!" } </Text>
</>
		);
	}, { forwardRef: true }
);

ServerInput.propTypes = {
	onError: PropTypes.func,
	onSuccess: PropTypes.func
};


const styles = StyleSheet.create({
	inputContainerStyle: {
	
		fontSize:24,
		borderRadius: 3,
		borderBottomWidth: 0,
		color:'red',
		alignSelf: 'center'
	},
	inputContainerStyle1: {
	
		fontSize:24,
		borderRadius: 3,
		borderBottomWidth: 0,
		color:'yellow',
		alignSelf: 'center'
	}
});

export default ServerInput;
