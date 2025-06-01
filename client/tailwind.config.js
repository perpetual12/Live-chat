/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,jsx}",
    ],
    theme: {
       extend: {
        colors: {
            'dark-blue': '#1a237e',
            'darker-blue': '#0d1b4a',
        },
       },
    },
    plugins: [],
}