import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        helvetica: ['"Helvetica Neue"', 'Helvetica', 'Arial', 'sans-serif'],
      },
      colors: {
        primary: '#FF0000',
        yellow: '#fffc00',
        'light-yellow': '#ECEB98',
        'dark-yellow': '#b4690e',
        'light-purple': '#D974DB',
        'dark-purple': '#380099',
        background: 'var(--background)',
        foreground: 'var(--foreground)',
      },
      screens: {
        tiny: { max: '374px' },
        xs: { min: '375px', max: '414px' },
        'sm-custom': { min: '415px', max: '740px' },
        mid0: { min: '768px', max: '999px' },
        mid1: { min: '1000px', max: '1199px' },
        mid2: { min: '1200px', max: '1399px' },
        mid3: { min: '1400px', max: '1599px' },
        mid4: { min: '1600px' }, // 1600px and up
      },
    },
  },
  plugins: [],
};

export default config;
