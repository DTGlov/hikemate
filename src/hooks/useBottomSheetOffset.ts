import { useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CREW_SHEET_PEEK_PERCENT } from '@/components/crew/CrewMembersBottomSheet';
import { useCrewStore } from '@/stores/useCrewStore';

// Pixels to leave between the sheet's peek edge and the bottom of any
// on-map control sitting above it. Visual breathing room.
const SHEET_GAP = 16;

// Default clearance for on-map controls when no sheet is mounted —
// matches the historical `insets.bottom + TAB_BAR_OFFSET` baseline used
// by StartHikeButton / ActiveHikeOverlay so solo behavior is unchanged.
const TAB_BAR_OFFSET = 72;

/**
 * Returns the `bottom` value (in pixels, for `position: absolute`) that
 * an on-map control should use to sit above the home tab bar AND, when
 * the user is in a crew, above the CrewMembersBottomSheet at its peek
 * snap point. Solo callers get the original baseline; in-crew callers
 * get a higher position so the sheet never covers the control at peek.
 *
 * Use directly inside any on-map button component; the hook reads crew
 * state from the store on its own.
 */
export function useBottomSheetOffset(): number {
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const inCrew = useCrewStore((s) => s.crew !== null);

  const baseline = insets.bottom + TAB_BAR_OFFSET;
  if (!inCrew) return baseline;
  const aboveSheet = height * CREW_SHEET_PEEK_PERCENT + SHEET_GAP;
  // Never push lower than the solo baseline (only matters on very tall
  // screens where 22% would land below the tab bar — defensive).
  return Math.max(baseline, aboveSheet);
}
