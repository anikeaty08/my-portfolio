/** Device-dependent quality knobs. */
const coarse = typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches;
const small = typeof window !== "undefined" && Math.min(window.innerWidth, window.innerHeight) < 700;

export const quality = {
  touch: coarse,
  mobile: coarse || small,
  shadowMap: coarse || small ? 1024 : 2048,
  maxDpr: coarse || small ? 1.5 : 2,
};
