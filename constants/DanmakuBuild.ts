import Constants from 'expo-constants';
import {Platform} from 'react-native';

export const IS_DANMAKU_BUILD=Constants.expoConfig?.android?.package==='com.oriontv.danmaku.dev';
// Some projector firmware reports a non-TV UI mode. This dedicated package remains a TV app.
export const IS_DANMAKU_TV=Platform.OS==='android'&&(Platform.isTV||IS_DANMAKU_BUILD);
