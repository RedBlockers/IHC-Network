export const BANNERS = {
    nebula: "linear-gradient(135deg, #6d5cff, #c026d3 58%, #3b0d6b)",
    dawn: "linear-gradient(135deg, #ff6a3d, #f0a12e 52%, #c026d3)",
    ocean: "linear-gradient(135deg, #12b5c9, #3b82f6 58%, #6d5cff)",
    ember: "linear-gradient(135deg, #f0523f, #f0a12e)",
    forest: "linear-gradient(135deg, #10b981, #12b5c9 55%, #065f46)",
    mono: "linear-gradient(135deg, #2a2f3b, #14161f)",
    aurora: "linear-gradient(120deg, #3fb950, #12b5c9 38%, #6d5cff 76%, #c026d3)",
};

export const BANNER_KEYS = Object.keys(BANNERS);
export const bannerGradient = (key) => BANNERS[key] || BANNERS.nebula;
