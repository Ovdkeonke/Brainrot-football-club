export default function App() {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  const isDev = new URLSearchParams(window.location.search).get('dev') === '1';
  const gameFile = isDev ? 'dev.html' : 'index.html';
  const gameUrl = `${base}/game/${gameFile}`;

  return (
    <iframe
      src={gameUrl}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        border: 'none',
        display: 'block',
      }}
      allowFullScreen
      allow="autoplay; microphone"
    />
  );
}
