/** @type {import('tailwindcss').Config} */
module.exports = {
	darkMode: ["class"],
	content: ["./src/index.html", "./src/**/*.{ts,tsx,js,jsx}"],
	theme: {
    	extend: {
    		fontFamily: {
    			sans: [
    				'"Zain"',
    				'sans-serif'
    			],
    			mono: [
    				'"Zain"',
    				'sans-serif'
    			]
    		},
    		borderRadius: {
    			lg: 'var(--radius)',
    			md: 'calc(var(--radius) - 2px)',
    			sm: 'calc(var(--radius) - 4px)'
    		},
    		colors: {
    			background: 'hsl(var(--background))',
    			foreground: 'hsl(var(--foreground))',
    			card: {
    				DEFAULT: 'hsl(var(--card))',
    				foreground: 'hsl(var(--card-foreground))'
    			},
    			popover: {
    				DEFAULT: 'hsl(var(--popover))',
    				foreground: 'hsl(var(--popover-foreground))'
    			},
    			primary: {
    				DEFAULT: 'hsl(var(--primary))',
    				foreground: 'hsl(var(--primary-foreground))'
    			},
    			secondary: {
    				DEFAULT: 'hsl(var(--secondary))',
    				foreground: 'hsl(var(--secondary-foreground))'
    			},
    			muted: {
    				DEFAULT: 'hsl(var(--muted))',
    				foreground: 'hsl(var(--muted-foreground))'
    			},
    			accent: {
    				DEFAULT: 'hsl(var(--accent))',
    				foreground: 'hsl(var(--accent-foreground))'
    			},
    			destructive: {
    				DEFAULT: 'hsl(var(--destructive))',
    				foreground: 'hsl(var(--destructive-foreground))'
    			},
    			border: 'hsl(var(--border))',
    			input: 'hsl(var(--input))',
    			ring: 'hsl(var(--ring))',
    			chart: {
    				'1': 'hsl(var(--chart-1))',
    				'2': 'hsl(var(--chart-2))',
    				'3': 'hsl(var(--chart-3))',
    				'4': 'hsl(var(--chart-4))',
    				'5': 'hsl(var(--chart-5))'
    			},
    			sidebar: {
    				DEFAULT: 'hsl(var(--sidebar-background))',
    				foreground: 'hsl(var(--sidebar-foreground))',
    				primary: 'hsl(var(--sidebar-primary))',
    				'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
    				accent: 'hsl(var(--sidebar-accent))',
    				'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
    				border: 'hsl(var(--sidebar-border))',
    				ring: 'hsl(var(--sidebar-ring))'
    			},
    			eggshell: {
    				'50': 'hsl(44.2 76% 95.1%)',
    				'100': 'hsl(47 72.5% 90%)',
    				'200': 'hsl(45.8 74.5% 80%)',
    				'300': 'hsl(46.2 73.9% 70%)',
    				'400': 'hsl(46 73.5% 60%)',
    				'500': 'hsl(46 74.1% 50%)',
    				'600': 'hsl(46 73.5% 40%)',
    				'700': 'hsl(46.2 73.9% 30%)',
    				'800': 'hsl(45.8 74.5% 20%)',
    				'900': 'hsl(47 72.5% 10%)',
    				'950': 'hsl(46.2 72.2% 7.1%)'
    			},
    			'tea-green': {
    				'50': 'hsl(90 23.1% 94.9%)',
    				'100': 'hsl(87.7 25.5% 90%)',
    				'200': 'hsl(87.7 25.5% 80%)',
    				'300': 'hsl(87.7 25.5% 70%)',
    				'400': 'hsl(88.2 25.1% 60.2%)',
    				'500': 'hsl(87.6 24.7% 50%)',
    				'600': 'hsl(88.2 24.9% 40.2%)',
    				'700': 'hsl(87.7 25.5% 30%)',
    				'800': 'hsl(87.7 25.5% 20%)',
    				'900': 'hsl(87.7 25.5% 10%)',
    				'950': 'hsl(86.7 25.7% 6.9%)'
    			},
    			'muted-teal': {
    				'50': 'hsl(145.7 28% 95.1%)',
    				'100': 'hsl(152 29.4% 90%)',
    				'200': 'hsl(152.1 27.5% 80%)',
    				'300': 'hsl(152.1 28.1% 70%)',
    				'400': 'hsl(152.1 28.4% 60%)',
    				'500': 'hsl(152.1 27.8% 50%)',
    				'600': 'hsl(152.1 28.4% 40%)',
    				'700': 'hsl(152.1 28.1% 30%)',
    				'800': 'hsl(152.1 27.5% 20%)',
    				'900': 'hsl(152 29.4% 10%)',
    				'950': 'hsl(150 27.8% 7.1%)'
    			},
    			'tropical-teal': {
    				'50': 'hsl(180 30.8% 94.9%)',
    				'100': 'hsl(176 29.4% 90%)',
    				'200': 'hsl(176.2 31.4% 80%)',
    				'300': 'hsl(176.2 30.7% 70%)',
    				'400': 'hsl(175.3 31.4% 60%)',
    				'500': 'hsl(176.2 31% 50%)',
    				'600': 'hsl(175.3 31.4% 40%)',
    				'700': 'hsl(176.2 30.7% 30%)',
    				'800': 'hsl(176.3 31.4% 20%)',
    				'900': 'hsl(176 29.4% 10%)',
    				'950': 'hsl(180 31.4% 6.9%)'
    			},
    			'jungle-teal': {
    				'50': 'hsl(140 23.1% 94.9%)',
    				'100': 'hsl(138.5 25.5% 90%)',
    				'200': 'hsl(138.5 25.5% 80%)',
    				'300': 'hsl(138.5 25.5% 70%)',
    				'400': 'hsl(137.6 25.1% 60.2%)',
    				'500': 'hsl(138.1 24.7% 50%)',
    				'600': 'hsl(137.6 24.9% 40.2%)',
    				'700': 'hsl(138.5 25.5% 30%)',
    				'800': 'hsl(138.5 25.5% 20%)',
    				'900': 'hsl(138.5 25.5% 10%)',
    				'950': 'hsl(140 25.7% 6.9%)'
    			}
    		},
    		keyframes: {
    			progress: {
    				'0%': {
    					transform: 'translateX(0) scaleX(0)'
    				},
    				'40%': {
    					transform: 'translateX(0) scaleX(0.4)'
    				},
    				'100%': {
    					transform: 'translateX(100%) scaleX(0.5)'
    				}
    			},
    			'accordion-down': {
    				from: {
    					height: '0'
    				},
    				to: {
    					height: 'var(--radix-accordion-content-height)'
    				}
    			},
    			'accordion-up': {
    				from: {
    					height: 'var(--radix-accordion-content-height)'
    				},
    				to: {
    					height: '0'
    				}
    			}
    		},
    		animation: {
    			progress: 'progress 1s infinite linear',
    			'accordion-down': 'accordion-down 0.2s ease-out',
    			'accordion-up': 'accordion-up 0.2s ease-out'
    		}
    	}
    },
	plugins: [require("tailwindcss-animate")],
};
