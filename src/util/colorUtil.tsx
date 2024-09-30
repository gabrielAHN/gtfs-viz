export const rgbToHex = (rgb: [number, number, number]): string => {
    const [r, g, b] = rgb;
    return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase()}`;
};

export const parseRgbString = (rgbString) => {
  const [r, g, b] = rgbString
    .replace(/[^\d,]/g, '')
    .split(',')
    .map(Number);
  return [r, g, b ];
};

export const ColorsRanges = [
    'rgb(252, 222, 156)',
    'rgb(250, 164, 118)',
    'rgb(240, 116, 110)',
    'rgb(227, 79, 111)',
    'rgb(220, 57, 119)',
    'rgb(185, 37, 122)',
    'rgb(124, 29, 111)',
];
