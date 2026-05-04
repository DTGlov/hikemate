import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { SvgUri } from 'react-native-svg';

import { ColoredInitialsCircle } from '@/components/avatar/ColoredInitialsCircle';
import { avatarUrl } from '@/lib/avatar';

type Props = {
  /** DiceBear seed. Pass null to fall straight to the colored fallback. */
  seed: string | null;
  /** Used for the initials fallback when the SVG can't load or seed is null. */
  displayName: string;
  /** Color for the fallback circle and (if `ringColor` is true) the ring. */
  fallbackColor: string;
  size: number;
  /** Optional 2pt ring around the avatar — used in the bottom sheet so the
   *  avatar still maps visually to the member's colored map dot. */
  ringColor?: string;
};

/**
 * DiceBear avatar with graceful degradation to ColoredInitialsCircle.
 *
 * SvgUri fetches the SVG over HTTPS on first render. The URL is memoised
 * on (seed, size) so re-renders of the parent don't re-trigger the fetch;
 * the platform's HTTP layer additionally caches the response.
 *
 * While the fetch is in flight or if it errors out, we render the colored
 * initials circle in the same footprint — the layout never reflows.
 */
export function Avatar({
  seed,
  displayName,
  fallbackColor,
  size,
  ringColor,
}: Props): React.JSX.Element {
  const [hasError, setHasError] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  const url = useMemo(
    () => (seed ? avatarUrl(seed, size) : null),
    [seed, size],
  );

  const ringWidth = ringColor ? 2 : 0;
  const innerSize = size - ringWidth * 2;

  const inner =
    !url || hasError ? (
      <ColoredInitialsCircle
        color={fallbackColor}
        displayName={displayName}
        size={innerSize}
      />
    ) : (
      <View
        style={{
          width: innerSize,
          height: innerSize,
          borderRadius: innerSize / 2,
          overflow: 'hidden',
          backgroundColor: fallbackColor,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {/* Skeleton until SvgUri reports loaded. ColoredInitialsCircle
            sits behind the SvgUri so a slow fetch shows the same
            footprint instead of a blank circle. */}
        {!isLoaded ? (
          <View
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
            }}
          >
            <ColoredInitialsCircle
              color={fallbackColor}
              displayName={displayName}
              size={innerSize}
            />
          </View>
        ) : null}
        <SvgUri
          uri={url}
          width={innerSize}
          height={innerSize}
          onLoad={() => setIsLoaded(true)}
          onError={() => setHasError(true)}
        />
      </View>
    );

  if (!ringColor) return inner;

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        borderWidth: ringWidth,
        borderColor: ringColor,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {inner}
    </View>
  );
}
