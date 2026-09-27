import { Platform } from 'react-native';
import { Asset } from 'expo-asset';
import { File, Paths } from 'expo-file-system';

// Live Activity DSL images can only load file URLs, so the Kindred check is copied
// into the app group container the widget extension can read.
const APP_GROUP = 'group.com.kindred.kindredtsl';
const FILE_NAME = 'KindredCheck-v1.png';

let pending: Promise<string | undefined> | null = null;

async function copyMark(): Promise<string | undefined> {
    const container = Paths.appleSharedContainers?.[APP_GROUP];
    if (!container) return undefined;

    const target = new File(container, FILE_NAME);
    if (target.exists) return target.uri;

    const [asset] = await Asset.loadAsync(require('@/assets/images/KindredCheck.png'));
    if (!asset?.localUri) return undefined;
    new File(asset.localUri).copy(target);
    return target.uri;
}

/** File URL of the brand check for Live Activities, or undefined if it can't be provided. */
export function brandMarkUri(): Promise<string | undefined> {
    if (Platform.OS !== 'ios') return Promise.resolve(undefined);
    if (!pending) {
        pending = copyMark().catch((e) => {
            console.warn('[LiveActivity] Could not prepare brand mark:', e);
            pending = null;
            return undefined;
        });
    }
    return pending;
}
