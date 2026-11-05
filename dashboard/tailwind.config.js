/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./html/**/*.html", "./html/**/*.js"],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'sans-serif'],
      },
      colors: {
        razor: "#8B5CF6",
        razorDark: "#7C3AED",
        discord: "#7C3AED",
        dark: "#070813",
        card: "#0C0E1D",
        discordBg: "#151828",
        discordDark: "#141624",
        discordHover: "#1B1E37",
        success: "#10B981",
        warning: "#F59E0B",
        surface: "#20243C",
        twitch: "#9146FF",
        twitchDark: "#6c35cc",
        youtube: "#FF0000",
        youtubeDark: "#cc0000",
        brand: "#5865F2",
        gold: "#FFD700",
        error: "#EF4444",
        ink: "#1a1a2e",
      },
      animation: {
        blob: 'blob 10s infinite',
        shimmer: 'shimmer 2s linear infinite',
        'fade-in-up': 'fadeInUp 0.5s ease-out forwards',
        'pulse-slow': 'pulse 3s ease-in-out infinite',
        'pulse-glow': 'pulseGlow 4s cubic-bezier(0.4,0,0.6,1) infinite',
        'float': 'float 6s ease-in-out infinite',
        'glitch': 'glitch 0.5s steps(1) infinite',
        'shake': 'shake 0.4s ease-in-out',
      },
      keyframes: {
        blob: {
          '0%': { transform: 'translate(0px, 0px) scale(1)' },
          '33%': { transform: 'translate(30px, -50px) scale(1.1)' },
          '66%': { transform: 'translate(-20px, 20px) scale(0.9)' },
          '100%': { transform: 'translate(0px, 0px) scale(1)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '200% 0' },
          '100%': { backgroundPosition: '-200% 0' },
        },
        fadeInUp: {
          '0%': { opacity: '0', transform: 'translateY(15px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        pulseGlow: {
          '0%, 100%': { opacity: '0.4', transform: 'scale(1)' },
          '50%': { opacity: '0.8', transform: 'scale(1.1)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-20px)' },
        },
        glitch: {
          '0%, 100%': { clipPath: 'inset(0 0 90% 0)', transform: 'translateX(-3px)' },
          '20%': { clipPath: 'inset(40% 0 40% 0)', transform: 'translateX(3px)' },
          '40%': { clipPath: 'inset(80% 0 5% 0)', transform: 'translateX(-2px)' },
          '60%': { clipPath: 'inset(10% 0 70% 0)', transform: 'translateX(2px)' },
          '80%': { clipPath: 'inset(60% 0 20% 0)', transform: 'translateX(-1px)' },
        },
        shake: {
          '0%, 100%': { transform: 'translateX(0)' },
          '25%': { transform: 'translateX(-4px)' },
          '75%': { transform: 'translateX(4px)' },
        },
      },
    },
  },
  plugins: [],
};
