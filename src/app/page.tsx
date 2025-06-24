import GameCarousel from '../components/GameCarousel';
import { LobbyList } from '../components/LobbyList';
import { GameFeed } from '../components/GameFeed';

export default function Home() {
  return (
    <main>
      <GameCarousel />
      <LobbyList />
      <GameFeed />
    </main>
  );
}
