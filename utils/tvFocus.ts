import {View} from 'react-native';

/** RN TVOS 0.74 View exposes this command at runtime; its upstream .d.ts omits it. */
export function focusTV(view:View|null):void {
 (view as (View&{requestTVFocus?:()=>void})|null)?.requestTVFocus?.();
}
