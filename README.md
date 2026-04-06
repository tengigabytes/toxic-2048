# Toxic 2048: Rush Edition 🚀

A high-octane, neon-drenched evolution of the classic 2048 puzzle game, built with React 19, Vite, and HTML5 Canvas.

![Toxic 2048 Screenshot](https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6)

## ✨ Features

- **Multiplication Merge**: Forget simple addition. Squares multiply upon merging (2x2=4, 4x4=16, 256x256=65,536...), leading to astronomical numbers and scores.
- **Rush Mode**: Achieve 5 consecutive merges to trigger Rush Mode, doubling your score gain with pulse-pounding visual effects.
- **Toxic Spawning**: Dynamic difficulty that spawns higher-value tiles as your score increases.
- **Sleek Visuals**: Smooth Canvas rendering, particle systems, and a modern "Toxic" aesthetic using Tailwind CSS and Framer Motion.
- **Persistence**: High scores, today's best, and play streaks are saved locally.

## 🛠️ Tech Stack

- **Framework**: [React 19](https://react.dev/)
- **Build Tool**: [Vite](https://vitejs.dev/)
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/)
- **Animations**: [Framer Motion](https://www.framer.com/motion/)
- **Icons**: [Lucide React](https://lucide.dev/)
- **Graphics**: HTML5 Canvas API

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18 or higher recommended)

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/your-username/toxic-2048-rush-edition.git
   cd toxic-2048-rush-edition
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. (Optional) Set up AI features:
   Create a `.env.local` file and add your Google Gemini API key:
   ```env
   VITE_GEMINI_API_KEY=your_api_key_here
   ```

4. Run the development server:
   ```bash
   npm run dev
   ```

5. Open [http://localhost:3000](http://localhost:3000) in your browser.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Inspired by the original [2048](https://github.com/gabrielecirulli/2048) by Gabriele Cirulli.
- UI components and icons powered by [Lucide](https://lucide.dev/).
