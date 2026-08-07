# E36 Badge Companion App

A web-based companion application for the E36 badge device, allowing users to customize faces, adjust brightness, edit boot animations, and manage device connections via Bluetooth Low Energy (BLE).

## Features

- **Device Connection**: Connect to E36 badge devices via BLE
- **Face Gallery**: Browse and select from preset faces or upload custom faces
- **Custom Face Upload**: Upload your own images to use as badge faces
- **Brightness Control**: Adjust the display brightness of the badge
- **Boot Animation Editor**: Create and upload custom boot animations
- **Transfer History**: View history of face transfers to the device
- **Progressive Web App**: Installable PWA with offline capabilities
- **Responsive Design**: Works on desktop and mobile devices

## Preset Faces

The app includes these preset faces:
- Roundel Glow
- Checkered Flag
- Speedometer
- Flame
- Carbon Ring
- Minimal Clock

## Boot Animation Templates

Several animated templates are available for boot sequences:
- Minimal Clock (analog clock)
- Digital Display
- Weather Icon
- Battery Level
- Music Player
- Fitness Ring

## Getting Started

### Prerequisites

- Node.js (v18 or higher)
- npm or yarn
- A modern web browser with Web Bluetooth support (Chrome, Edge, or Opera recommended)

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

4. Open your browser to `http://localhost:5173` (or the URL shown in the terminal)

### Building for Production

```bash
npm run build
```

The built files will be in the `dist/` directory.

### Previewing Production Build

```bash
npm run preview
```

## Usage

1. **Connect to Device**: Click the "Connect" tab and scan for your E36 badge device
2. **Select Faces**: Go to the "Gallery" tab to choose from preset faces or upload custom ones
3. **Adjust Brightness**: Use the slider in the "Lighting" tab to set display brightness
4. **Edit Boot Animation**: Use the "Startup" tab to create custom boot animations
5. **View History**: Check the "Activity" tab to see transfer logs

## Technology Stack

- **Frontend**: React 19 with TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS
- **Icons**: Lucide React
- **State Management**: Custom React hooks
- **PWA**: Vite-plugin-PWA for offline capabilities
- **Bluetooth**: Web Bluetooth API (simulated in development)

## Development

### Code Structure

- `src/components` - UI components
- `src/hooks` - Custom React hooks (BLE management, face storage, theme, transfer history)
- `src/data` - Static data (preset faces, boot animation templates)
- `src/types` - TypeScript type definitions
- `src/utils` - Utility functions

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint (when configured)
- `npm run format` - Run Prettier (when configured)

## Browser Support

The app uses modern web APIs including:
- Web Bluetooth API (for device communication)
- Service Workers (for PWA functionality)
- Canvas API (for image processing in face uploads)

Supported browsers:
- Chrome (recommended)
- Edge
- Opera
- Safari (limited Bluetooth support)
- Firefox (limited Bluetooth support)

## License

This project is licensed under the MIT License.

## Acknowledgments

- Built with [Vite](https://vitejs.dev/)
- Styled with [Tailwind CSS](https://tailwindcss.com/)
- Icons from [Lucide](https://lucide.dev/)
- Inspired by the E36 badge hardware project