export type IslHandMode = 'one-handed' | 'two-handed' | 'dynamic';

export interface IslLetterGuide {
  letter: string;
  handMode: IslHandMode;
  postureTitle: string;
  instructions: string[];
  islVsAslNote: string;
  cameraTip: string;
}

export const ISL_ALPHABET_GUIDE: IslLetterGuide[] = [
  {
    letter: 'A',
    handMode: 'two-handed',
    postureTitle: 'Base Fist with Thumb Up, Index Touching Thumb Tip',
    instructions: [
      'Hold your non-dominant hand in a relaxed upright fist with the thumb pointing upward.',
      'Extend the index finger of your dominant hand and touch the tip of the upright thumb.',
      'Keep both hands centered at chest height facing the camera.',
    ],
    islVsAslNote: 'Authentic ISL forms A with two hands interacting; ASL uses a single closed fist.',
    cameraTip: 'Separate wrists slightly so MediaPipe clearly tracks all 42 landmarks across both hands.',
  },
  {
    letter: 'B',
    handMode: 'two-handed',
    postureTitle: 'Dual Curved Palms Forming Two Connected Loops',
    instructions: [
      'Curve the fingers and thumbs of both hands into two symmetrical half-circle shapes.',
      'Bring both hands together side-by-side at chest level with fingertips meeting.',
      'Angle palms slightly forward so the finger arches stay visible.',
    ],
    islVsAslNote: 'ISL B uses a symmetrical bimanual double-loop; ASL B uses one flat upright palm.',
    cameraTip: 'Avoid overlapping fingers deeply; keep a crisp silhouette against a plain background.',
  },
  {
    letter: 'C',
    handMode: 'one-handed',
    postureTitle: 'Single Curved Hand Forming a Semicircle',
    instructions: [
      'Raise your dominant hand to shoulder height.',
      'Curve all four fingers together and oppose the thumb to outline a clear "C" arch.',
      'Turn the palm slightly sideways toward the viewer so the opening is legible.',
    ],
    islVsAslNote: 'Both ISL and ASL represent C with a single curved hand shape.',
    cameraTip: 'Ensure the gap between thumb tip and index fingertip remains clearly visible.',
  },
  {
    letter: 'D',
    handMode: 'two-handed',
    postureTitle: 'Upright Index Pillar Framed by Curved Opposite Hand',
    instructions: [
      'Point the index finger of your base hand straight upward.',
      'Curve your dominant hand into a "C" arc and place its fingertips against the upright index finger.',
      'Together the vertical finger and curved hand outline a capital "D".',
    ],
    islVsAslNote: 'ISL D pairs an upright pillar finger with a curved opposite hand; ASL D uses one hand.',
    cameraTip: 'Keep the upright index finger behind or cleanly beside the curved fingers.',
  },
  {
    letter: 'E',
    handMode: 'two-handed',
    postureTitle: 'Curled Fingers Resting Across Open Base Palm',
    instructions: [
      'Hold your non-dominant palm open and tilted upward as a flat base.',
      'Slightly curve the fingers of your dominant hand horizontally toward the base palm.',
      'Position fingertips near the center of the open base hand.',
    ],
    islVsAslNote: 'Authentic ISL E uses two-handed horizontal placement; ASL E curls fingers onto one thumb.',
    cameraTip: 'Tilt the base hand slightly toward the lens so its palm landmarks are not occluded.',
  },
  {
    letter: 'F',
    handMode: 'two-handed',
    postureTitle: 'Two-Finger Crossed Horizontal Bars',
    instructions: [
      'Extend index and middle fingers on both hands while tucking ring and pinky fingers.',
      'Place the extended fingers of your dominant hand horizontally across the fingers of your base hand.',
      'Keep wrists angled naturally outward at chest height.',
    ],
    islVsAslNote: 'ISL F crosses two-finger pairs bimanually; ASL F pinches thumb and index on one hand.',
    cameraTip: 'Keep a slight depth separation between the two crossing hands.',
  },
  {
    letter: 'G',
    handMode: 'two-handed',
    postureTitle: 'Bimanual Hooked Thumb-Index Frame',
    instructions: [
      'Form a small curved C-hook with thumb and index on your base hand.',
      'Use your dominant hand index and thumb to frame the lower hook beside it.',
      'Keep remaining fingers softly curled inward.',
    ],
    islVsAslNote: 'ISL G uses both hands to shape the letter contour; ASL G points one hand horizontally.',
    cameraTip: 'Face the camera squarely so both hand arches remain unobstructed.',
  },
  {
    letter: 'H',
    handMode: 'two-handed',
    postureTitle: 'Flat Hand Resting or Brushing Across Open Base Palm',
    instructions: [
      'Hold your non-dominant hand open with palm facing upward.',
      'Extend your dominant hand flat with fingers together, resting across the base palm.',
      'Hold steady for static recognition or perform a gentle forward brush.',
    ],
    islVsAslNote: 'Traditional ISL H interacts across the open base palm; ASL H points two fingers sideways.',
    cameraTip: 'Keep all five fingertips of the upper hand visible above the base palm.',
  },
  {
    letter: 'I',
    handMode: 'one-handed',
    postureTitle: 'Single Hand Pinky Extended Straight Up',
    instructions: [
      'Curl your index, middle, and ring fingers into your palm and secure with your thumb.',
      'Extend only your pinky finger straight upward.',
      'Hold your hand upright at shoulder height.',
    ],
    islVsAslNote: 'Unimanual pinky-up I is widely used across ISLRTC; some regional variants tap the opposite pinky.',
    cameraTip: 'Keep the pinky upright and clearly separated from the folded ring finger.',
  },
  {
    letter: 'J',
    handMode: 'dynamic',
    postureTitle: 'Dynamic Motion: Pinky Extended Tracing a "J" Hook',
    instructions: [
      'Begin with the single-handed "I" posture (pinky extended upward, other fingers curled).',
      'Move your hand downward and curve smoothly sideways and slightly upward to trace a "J".',
      'Maintain steady motion speed over ~0.6 seconds.',
    ],
    islVsAslNote: 'Because J requires motion, MudraLab uses a temporal trajectory detector instead of a static frame.',
    cameraTip: 'Keep your elbow relaxed and trace a clear 15–20 cm J-curve inside the camera frame.',
  },
  {
    letter: 'K',
    handMode: 'two-handed',
    postureTitle: 'Upright Index Pillar Joined by Angled Two-Finger V',
    instructions: [
      'Point your non-dominant index finger straight upward as the vertical stem.',
      'Extend index and middle fingers on your dominant hand and angle them against the vertical finger.',
      'Together both hands visibly form the letter "K".',
    ],
    islVsAslNote: 'ISL K forms the literal K shape using two hands; ASL K places thumb between two upright fingers.',
    cameraTip: 'Keep both hands side-by-side in the focal plane rather than stacking front-to-back.',
  },
  {
    letter: 'L',
    handMode: 'one-handed',
    postureTitle: 'Thumb and Index Extended at 90 Degrees',
    instructions: [
      'Raise your dominant hand with palm facing the camera.',
      'Extend your index finger straight up and your thumb straight out to the side.',
      'Fold middle, ring, and pinky fingers cleanly into the palm.',
    ],
    islVsAslNote: 'Both ISL and ASL form L with a right-angle thumb and index finger.',
    cameraTip: 'Keep the 90-degree corner open and facing the lens.',
  },
  {
    letter: 'M',
    handMode: 'two-handed',
    postureTitle: 'Three Fingers Placed Across Open Base Palm',
    instructions: [
      'Hold your non-dominant hand open with palm facing upward.',
      'Extend index, middle, and ring fingers of your dominant hand (thumb and pinky folded).',
      'Place those three fingers across the open base palm to represent the three strokes of "M".',
    ],
    islVsAslNote: 'ISL M clearly displays 3 fingers on the base palm; ASL M tucks the thumb under 3 closed fingers.',
    cameraTip: 'Slightly spread the three fingers so MediaPipe distinguishes M (3) from N (2).',
  },
  {
    letter: 'N',
    handMode: 'two-handed',
    postureTitle: 'Two Fingers Placed Across Open Base Palm',
    instructions: [
      'Hold your non-dominant hand open with palm facing upward.',
      'Extend only the index and middle fingers of your dominant hand.',
      'Rest those two fingers neatly across the open base palm.',
    ],
    islVsAslNote: 'ISL N uses 2 fingers across the base palm (contrast with M using 3 fingers).',
    cameraTip: 'Ensure ring and pinky fingers are firmly curled so the classifier distinguishes N from M.',
  },
  {
    letter: 'O',
    handMode: 'one-handed',
    postureTitle: 'All Fingertips Meet Thumb to Form a Closed Circle',
    instructions: [
      'Curve all four fingers and thumb of your dominant hand inward.',
      'Touch the fingertips lightly to the thumb tip to form a round "O".',
      'Angle the hand slightly sideways so the circular loop is visible.',
    ],
    islVsAslNote: 'Consistent single-handed O loop across standard ISL and ASL alphabets.',
    cameraTip: 'Avoid squashing the loop flat; keep a visible round opening inside the fingers.',
  },
  {
    letter: 'P',
    handMode: 'two-handed',
    postureTitle: 'Upright Index Stem Topped by Small Thumb-Index Loop',
    instructions: [
      'Point the index finger of your base hand straight upward.',
      'Form a small pinched loop with the thumb and index finger of your dominant hand.',
      'Place the loop against the upper half of the upright index finger to form "P".',
    ],
    islVsAslNote: 'ISL P builds the visual P shape bimanually; ASL P points a modified K downward.',
    cameraTip: 'Position the loop near the top joint of the base index finger.',
  },
  {
    letter: 'Q',
    handMode: 'two-handed',
    postureTitle: 'Rounded Finger Circle with Lower Diagonal Tail',
    instructions: [
      'Form a rounded "O" circle using your non-dominant hand.',
      'Point your dominant index finger diagonally downward across the bottom edge of the circle.',
      'Hold both hands steady at chest level.',
    ],
    islVsAslNote: 'ISL Q visually constructs the circle and tail with two hands.',
    cameraTip: 'Keep the tail finger pointing clearly downward-right below the loop.',
  },
  {
    letter: 'R',
    handMode: 'two-handed',
    postureTitle: 'Hooked Index Finger Placed Across Open Base Palm',
    instructions: [
      'Hold your non-dominant hand open with palm facing upward.',
      'Curve your dominant index finger into a bent hook shape while tucking the other fingers.',
      'Rest the hooked index finger onto the base palm.',
    ],
    islVsAslNote: 'ISL R uses a hooked finger on the base palm; ASL R crosses index and middle fingers.',
    cameraTip: 'Keep the bend of the hooked index finger clearly profiled.',
  },
  {
    letter: 'S',
    handMode: 'two-handed',
    postureTitle: 'Both Hands Interlocking Curved Pinky/Fingers',
    instructions: [
      'Curl both hands into loose curves with pinky fingers extended slightly as hooks.',
      'Bring both hands together symmetrically in front of your chest, linking the curved fingers.',
      'Keep wrists relaxed and facing inward toward each other.',
    ],
    islVsAslNote: 'ISL S uses a symmetric bimanual hook/link; ASL S is a single closed fist.',
    cameraTip: 'Leave slight spacing between palms so MediaPipe detects two distinct hands.',
  },
  {
    letter: 'T',
    handMode: 'two-handed',
    postureTitle: 'Dominant Index Finger Forming Crossbar Over Upright Index',
    instructions: [
      'Point your non-dominant index finger straight upward.',
      'Extend your dominant index finger horizontally across the tip of the upright finger.',
      'Form a crisp perpendicular capital "T".',
    ],
    islVsAslNote: 'ISL T builds a literal T crossbar with both index fingers; ASL T tucks thumb under index.',
    cameraTip: 'Keep both index fingers straight and perpendicular.',
  },
  {
    letter: 'U',
    handMode: 'one-handed',
    postureTitle: 'Index and Middle Fingers Upright Together',
    instructions: [
      'Extend your index and middle fingers straight upward, pressed side-by-side.',
      'Fold ring and pinky fingers down and secure them with your thumb.',
      'Face your palm forward toward the camera.',
    ],
    islVsAslNote: 'Commonly signed unimanually in ISLRTC; keep index and middle touching (unlike V).',
    cameraTip: 'Keep index and middle fingers together without a V-gap.',
  },
  {
    letter: 'V',
    handMode: 'one-handed',
    postureTitle: 'Index and Middle Fingers Spread in a "V"',
    instructions: [
      'Extend your index and middle fingers straight upward and spread them apart into a "V".',
      'Fold ring and pinky fingers into your palm with your thumb holding them down.',
      'Face palm cleanly toward the lens.',
    ],
    islVsAslNote: 'Both ISL and ASL use a clear V spread; spread width differentiates V from U.',
    cameraTip: 'Maintain a distinct angle (~25–35 degrees) between index and middle fingers.',
  },
  {
    letter: 'W',
    handMode: 'two-handed',
    postureTitle: 'Both Hands Open and Angled Outward Forming a Wide W',
    instructions: [
      'Open both hands with fingers slightly spread and thumbs relaxed.',
      'Bring the lower edges of your palms near each other while angling fingertips outward.',
      'Together both hands create a clear symmetric "W" fan.',
    ],
    islVsAslNote: 'Traditional ISL W opens both hands symmetrically; ASL W raises three fingers on one hand.',
    cameraTip: 'Keep both palms facing the camera at equal height.',
  },
  {
    letter: 'X',
    handMode: 'two-handed',
    postureTitle: 'Both Index Fingers Crossed Diagonally',
    instructions: [
      'Extend the index finger on both your left and right hands (other fingers curled).',
      'Cross both index fingers diagonally in front of your chest to form an "X".',
      'Hold steady at chest height.',
    ],
    islVsAslNote: 'ISL X crosses both index fingers; ASL X hooks one single index finger.',
    cameraTip: 'Ensure the crossing point stays near the center of the fingers.',
  },
  {
    letter: 'Y',
    handMode: 'two-handed',
    postureTitle: 'Base Thumb-Index V Joined by Diagonal Index Stem',
    instructions: [
      'Open the thumb and index finger of your non-dominant hand into an upright V-fork.',
      'Point your dominant index finger diagonally downward to meet the base of that fork.',
      'Keep remaining fingers curled gently inward.',
    ],
    islVsAslNote: 'ISL Y forms the Y fork bimanually; ASL Y extends thumb and pinky on one hand.',
    cameraTip: 'Keep the thumb-index V clearly open toward the camera.',
  },
  {
    letter: 'Z',
    handMode: 'dynamic',
    postureTitle: 'Dynamic Motion: Index Finger Tracing a "Z" Zig-Zag',
    instructions: [
      'Extend only your index finger forward/upward.',
      'Trace a sharp horizontal right sweep, diagonal down-left stroke, and horizontal right sweep.',
      'Complete the zig-zag smoothly in front of your chest.',
    ],
    islVsAslNote: 'Dynamic motion sign handled by the temporal trajectory detector rather than a static frame.',
    cameraTip: 'Make crisp corner turns on the three strokes of the Z path.',
  },
];
