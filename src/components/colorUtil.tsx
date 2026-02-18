export const rgbToHex = (rgb) => {
    const [r, g, b] = rgb;
    return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase()}`;
};

export const parseRgbString = (rgbString) => {
    const [r, g, b] = rgbString
        .replace(/[^\d,]/g, '')
        .split(',')
        .map(Number);
    return [r, g, b];
};

export const hexToRgb = (hex) => {
    
    const cleanHex = hex.replace('#', '');
    const r = parseInt(cleanHex.substring(0, 2), 16);
    const g = parseInt(cleanHex.substring(2, 4), 16);
    const b = parseInt(cleanHex.substring(4, 6), 16);
    return [r, g, b];
};

export const hslToRgb = (hsl) => {
    
    const matches = hsl.match(/hsl\(([^)]+)\)/);
    if (!matches) return [160, 160, 160]; 

    const parts = matches[1].split(/[\s,]+/).map(s => s.replace('%', ''));
    const h = parseFloat(parts[0]) / 360;
    const s = parseFloat(parts[1]) / 100;
    const l = parseFloat(parts[2]) / 100;

    let r, g, b;
    if (s === 0) {
        r = g = b = l; 
    } else {
        const hue2rgb = (p, q, t) => {
            if (t < 0) t += 1;
            if (t > 1) t -= 1;
            if (t < 1/6) return p + (q - p) * 6 * t;
            if (t < 1/2) return q;
            if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
            return p;
        };
        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const p = 2 * l - q;
        r = hue2rgb(p, q, h + 1/3);
        g = hue2rgb(p, q, h);
        b = hue2rgb(p, q, h - 1/3);
    }
    return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
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
